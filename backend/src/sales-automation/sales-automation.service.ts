import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';

export interface AutomationRunSummary {
  tenantId?: string;
  scannedDeals: number;
  createdActivities: number;
  skippedDeals: number;
  errors: Array<{ dealId?: string; message: string }>;
}

type FollowUpDecision =
  | { shouldCreate: false }
  | {
      shouldCreate: true;
      type: string;
      subject: string;
      dueDate: Date;
      description: string;
    };

const AUTOMATION_MARKER = '[Sales Automation]';

@Injectable()
export class SalesAutomationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SalesAutomationService.name);
  private timer: NodeJS.Timeout | null = null;
  private lastRunAt: Date | null = null;
  private lastRunSummary: AutomationRunSummary | null = null;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  onModuleInit() {
    if (this.isDisabled()) return;

    const intervalMinutes = this.intervalMinutes();
    this.timer = setInterval(
      () => {
        void this.runAllTenants().catch((error) => {
          this.logger.error('Sales automation run failed', error);
        });
      },
      intervalMinutes * 60 * 1000,
    );
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  getStatus() {
    return {
      enabled: !this.isDisabled(),
      intervalMinutes: this.intervalMinutes(),
      running: this.running,
      lastRunAt: this.lastRunAt,
      lastRunSummary: this.lastRunSummary,
      marker: AUTOMATION_MARKER,
    };
  }

  async runAllTenants() {
    if (this.running) return this.lastRunSummary || this.emptySummary();
    this.running = true;

    const aggregate = this.emptySummary();

    try {
      const tenants = await this.prisma.tenant.findMany({
        select: { id: true },
      });

      for (const tenant of tenants) {
        const summary = await this.runForTenant(tenant.id);
        aggregate.scannedDeals += summary.scannedDeals;
        aggregate.createdActivities += summary.createdActivities;
        aggregate.skippedDeals += summary.skippedDeals;
        aggregate.errors.push(...summary.errors);
      }

      this.lastRunAt = new Date();
      this.lastRunSummary = aggregate;
      return aggregate;
    } finally {
      this.running = false;
    }
  }

  async runForTenant(tenantId: string, userId?: string): Promise<AutomationRunSummary> {
    const summary = this.emptySummary(tenantId);
    const now = new Date();

    const deals = await this.prisma.deal.findMany({
      where: {
        tenantId,
        NOT: [
          { stage: { equals: 'Won', mode: 'insensitive' } },
          { stage: { equals: 'Lost', mode: 'insensitive' } },
          { stage: { equals: 'closed', mode: 'insensitive' } },
          { stage: { equals: 'closed won', mode: 'insensitive' } },
          { stage: { equals: 'closed lost', mode: 'insensitive' } },
        ],
      },
      include: {
        lead: true,
        activities: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        discoverySessions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        salesAssessments: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    summary.scannedDeals = deals.length;

    for (const deal of deals) {
      try {
        const decision = this.followUpDecision(deal, now);

        if (!decision.shouldCreate) {
          summary.skippedDeals += 1;
          continue;
        }

        const activity = await this.prisma.activity.create({
          data: {
            type: decision.type,
            subject: decision.subject,
            description: decision.description,
            dueDate: decision.dueDate,
            dealId: deal.id,
            tenantId,
          },
        });

        await this.auditService.log({
          tenantId,
          userId,
          action: 'AUTO_CREATE',
          entityType: 'ACTIVITY',
          entityId: activity.id,
          details: `Sales automation created follow-up for ${deal.name}`,
        });

        summary.createdActivities += 1;
      } catch (error) {
        summary.errors.push({
          dealId: deal.id,
          message: error instanceof Error ? error.message : 'Unable to automate follow-up',
        });
      }
    }

    this.lastRunAt = new Date();
    this.lastRunSummary = summary;
    return summary;
  }

  private followUpDecision(deal: any, now: Date): FollowUpDecision {
    const pendingActivities = deal.activities.filter((activity: any) => activity.status !== 'completed');
    const hasOpenAutomationTask = pendingActivities.some((activity: any) =>
      String(activity.description || '').includes(AUTOMATION_MARKER),
    );

    if (hasOpenAutomationTask) {
      return { shouldCreate: false };
    }

    const nextPending = pendingActivities
      .filter((activity: any) => activity.dueDate && activity.dueDate >= now)
      .sort((a: any, b: any) => a.dueDate.getTime() - b.dueDate.getTime())[0];

    if (nextPending) {
      return { shouldCreate: false };
    }

    const lastActivity = deal.activities[0] || null;
    const daysSinceActivity = lastActivity
      ? Math.floor((now.getTime() - lastActivity.createdAt.getTime()) / (1000 * 60 * 60 * 24))
      : null;
    const assessment = deal.salesAssessments[0] || null;
    const discovery = deal.discoverySessions[0] || null;
    const reasons: string[] = [];

    if (daysSinceActivity === null) reasons.push('No activity has been logged for this deal.');
    else if (daysSinceActivity >= 7) reasons.push(`No activity has been logged for ${daysSinceActivity} days.`);

    if (!discovery) reasons.push('Discovery is missing.');
    if ((assessment?.closeReadinessScore ?? 100) < 55) reasons.push('Close readiness is below target.');
    if ((assessment?.discoveryQualityScore ?? 100) < 60) reasons.push('Discovery quality is below target.');
    if ((assessment?.objectionRisks?.length || discovery?.objections?.length || 0) > 0) {
      reasons.push('Buyer objections need follow-up.');
    }

    if (reasons.length === 0) {
      return { shouldCreate: false };
    }

    const dueDate = new Date(now);
    dueDate.setDate(dueDate.getDate() + 1);
    dueDate.setHours(9, 0, 0, 0);

    const subject =
      assessment?.recommendedNextAction?.slice(0, 90) ||
      `Follow up with ${deal.lead.company}`;

    return {
      shouldCreate: true,
      type: deal.lead.email ? 'email' : 'task',
      subject,
      dueDate,
      description: [
        AUTOMATION_MARKER,
        `Deal: ${deal.name}`,
        `Company: ${deal.lead.company}`,
        `Recommended action: ${assessment?.recommendedNextAction || 'Restart the conversation and confirm the next step.'}`,
        `Reasons: ${reasons.join(' ')}`,
      ].join('\n'),
    };
  }

  private intervalMinutes() {
    const value = Number(process.env.SALES_AUTOMATION_INTERVAL_MINUTES || 1440);
    return Number.isFinite(value) && value >= 5 ? value : 1440;
  }

  private isDisabled() {
    return process.env.SALES_AUTOMATION_DISABLED === 'true';
  }

  private emptySummary(tenantId?: string): AutomationRunSummary {
    return {
      tenantId,
      scannedDeals: 0,
      createdActivities: 0,
      skippedDeals: 0,
      errors: [],
    };
  }
}
