import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AiInsightsService } from '../ai-insights/ai-insights.service';
import { RecommendationService } from '../ai-insights/recommendation.service';
import { RevenueInsightsService } from '../ai-insights/revenue-insights.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CopilotActionLink,
  CopilotIntent,
  CopilotSourceReference,
  CopilotStructuredResult,
} from './ai-copilot.types';

const OUTSTANDING_STATUSES = ['issued', 'resolved', 'disputed'];

@Injectable()
export class CopilotQueryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiInsightsService: AiInsightsService,
    private readonly revenueInsightsService: RevenueInsightsService,
    private readonly recommendationService: RecommendationService,
  ) {}

  async answerQuestion(
    tenantId: string,
    userId: string,
    question: string,
  ): Promise<CopilotStructuredResult> {
    const normalized = question.toLowerCase();
    const intent = this.detectIntent(normalized);

    if (intent === 'billing') {
      return this.answerBillingQuestion(tenantId, question);
    }

    if (intent === 'staffing' || intent === 'guards') {
      return this.answerStaffingQuestion(tenantId, normalized, question);
    }

    if (intent === 'revenue' || intent === 'clients') {
      return this.answerRevenueQuestion(tenantId, userId, normalized, question);
    }

    if (intent === 'incidents' || intent === 'sites') {
      return this.answerIncidentOrSiteQuestion(
        tenantId,
        userId,
        normalized,
        question,
      );
    }

    if (intent === 'reports') {
      return this.answerReportsQuestion(tenantId, question);
    }

    return this.answerGeneralQuestion(tenantId, userId, question);
  }

  private detectIntent(question: string): CopilotIntent {
    if (
      /(invoice|billing|bill|unpaid|overdue|outstanding|paid|payment|dispute|collection)/.test(
        question,
      )
    ) {
      return 'billing';
    }
    if (
      /(revenue|forecast|renewal|contract|growth|highest revenue|client value)/.test(
        question,
      )
    ) {
      return 'revenue';
    }
    if (
      /(missed|attendance|late|staff|staffing|shortage|coverage|shift|guard)/.test(
        question,
      )
    ) {
      return /(guard)/.test(question) ? 'guards' : 'staffing';
    }
    if (
      /(incident|risk|threat|unauthorized|access|case|resolution)/.test(
        question,
      )
    ) {
      return 'incidents';
    }
    if (/(site|location|post)/.test(question)) {
      return 'sites';
    }
    if (/(client|customer)/.test(question)) {
      return 'clients';
    }
    if (/(report|daily service|published)/.test(question)) {
      return 'reports';
    }
    return 'general';
  }

  private async answerIncidentOrSiteQuestion(
    tenantId: string,
    userId: string,
    normalized: string,
    question: string,
  ): Promise<CopilotStructuredResult> {
    if (/(risk|risky|top risk|critical)/.test(normalized)) {
      const incidentInsights = await this.aiInsightsService.getIncidentInsights(
        tenantId,
        userId,
      );
      const rows = incidentInsights.highRiskSites.slice(0, 5);
      const top = rows[0];
      const answer = top
        ? `${top.name} is currently the top risk site with a ${top.riskLevel} risk level, score ${top.riskScore}, and ${top.incidentCount} incidents in the analysis window. ${top.indicators[0] || ''}`.trim()
        : 'No high-risk site pattern is currently visible in the incident analysis window.';

      return {
        intent: 'incidents',
        answer,
        confidenceScore: top ? 0.88 : 0.72,
        sources: rows.map((row) =>
          this.source(
            'site',
            row.entityId,
            row.name,
            `/sites/${row.entityId}`,
            row.indicators.join('; '),
          ),
        ),
        actions: rows.map((row) =>
          this.action('View Site', 'site', `/sites/${row.entityId}`),
        ),
        knowledgeQuery: `${question} ${rows.map((row) => `${row.name} ${row.indicators.join(' ')}`).join(' ')}`,
        context: { highRiskSites: rows },
      };
    }

    const sites = await this.aiInsightsService.getSiteInsights(tenantId);
    const rows = [...sites.rows]
      .filter((site) => site.incidentCount > 0)
      .sort((left, right) => right.incidentCount - left.incidentCount)
      .slice(0, 5);
    const top = rows[0];
    const answer = top
      ? `${top.name} has the most incidents in the current site insight period with ${top.incidentCount} incident${top.incidentCount === 1 ? '' : 's'}. Its incident rate is ${top.incidentRate}%.`
      : 'No incidents are showing in the current site insight period.';

    return {
      intent: 'incidents',
      answer,
      confidenceScore: top ? 0.9 : 0.74,
      sources: rows.map((row) =>
        this.source(
          'site',
          row.siteId,
          row.name,
          `/sites/${row.siteId}`,
          `${row.incidentCount} incidents, ${row.incidentRate}% incident rate`,
        ),
      ),
      actions: rows.map((row) =>
        this.action('View Site', 'site', `/sites/${row.siteId}`),
      ),
      knowledgeQuery: `${question} ${rows.map((row) => `${row.name} incidents ${row.incidentCount}`).join(' ')}`,
      context: { sites: rows },
    };
  }

  private async answerBillingQuestion(
    tenantId: string,
    question: string,
  ): Promise<CopilotStructuredResult> {
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 30);

    const invoices = await this.prisma.invoice.findMany({
      where: {
        tenantId,
        status: { in: OUTSTANDING_STATUSES },
        OR: [
          { dueDate: { lt: now } },
          { dueDate: null, issuedAt: { lt: thirtyDaysAgo } },
          { dueDate: null, issuedAt: null, createdAt: { lt: thirtyDaysAgo } },
        ],
      },
      include: {
        client: { select: { id: true, name: true, companyName: true } },
        site: { select: { id: true, name: true } },
      },
      orderBy: [{ dueDate: 'asc' }, { issuedAt: 'asc' }, { createdAt: 'asc' }],
      take: 10,
    });

    const total = invoices.reduce(
      (sum, invoice) => sum + invoice.totalAmount,
      0,
    );
    const answer = invoices.length
      ? `${invoices.length} overdue or aging invoice${invoices.length === 1 ? '' : 's'} need attention, totaling ${this.formatCurrency(total)}. The oldest visible item is ${invoices[0].invoiceNumber} for ${this.clientName(invoices[0].client)}.`
      : 'No overdue or aging outstanding invoices were found.';

    return {
      intent: 'billing',
      answer,
      confidenceScore: 0.9,
      sources: invoices.map((invoice) =>
        this.source(
          'invoice',
          invoice.id,
          invoice.invoiceNumber,
          `/invoices/${invoice.id}`,
          `${this.clientName(invoice.client)} - ${this.formatCurrency(invoice.totalAmount)} - ${invoice.status}`,
        ),
      ),
      actions: invoices
        .slice(0, 5)
        .map((invoice) =>
          this.action('View Invoice', 'invoice', `/invoices/${invoice.id}`),
        ),
      knowledgeQuery: `${question} overdue unpaid invoice dispute billing ${invoices.map((invoice) => `${invoice.invoiceNumber} ${this.clientName(invoice.client)}`).join(' ')}`,
      context: {
        overdueInvoices: invoices.map((invoice) => ({
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          client: this.clientName(invoice.client),
          totalAmount: invoice.totalAmount,
          status: invoice.status,
          dueDate: invoice.dueDate,
        })),
      },
    };
  }

  private async answerStaffingQuestion(
    tenantId: string,
    normalized: string,
    question: string,
  ): Promise<CopilotStructuredResult> {
    if (/(shortage|coverage|unassigned|staffing)/.test(normalized)) {
      const overview =
        await this.recommendationService.getSchedulingOverview(tenantId);
      const gaps = overview.gaps.slice(0, 5);
      const answer =
        overview.shortageSlots > 0
          ? `${overview.shortageSlots} guard slot${overview.shortageSlots === 1 ? '' : 's'} need coverage across ${overview.coverageGaps} upcoming shift${overview.coverageGaps === 1 ? '' : 's'}. The largest visible gap is ${gaps[0]?.siteName || 'not available'}.`
          : `No upcoming staffing shortages were detected in the next ${overview.horizonDays} days.`;

      return {
        intent: 'staffing',
        answer,
        confidenceScore: 0.88,
        sources: gaps.map((gap) =>
          this.source(
            'shift',
            gap.shiftId,
            gap.siteName,
            `/shifts/${gap.shiftId}`,
            `${gap.shortageSlots} open slot${gap.shortageSlots === 1 ? '' : 's'}`,
          ),
        ),
        actions: gaps.map((gap) =>
          this.action('View Site', 'site', `/sites/${gap.siteId}`),
        ),
        knowledgeQuery: `${question} staffing shortage coverage ${gaps.map((gap) => gap.siteName).join(' ')}`,
        context: { schedulingOverview: overview },
      };
    }

    const missed = await this.getMissedShiftsLastWeek(tenantId);
    const top = missed[0];
    const answer = top
      ? `${top.guardName} has the most missed shifts in the last 7 days with ${top.missedShifts}. ${missed.length} guard${missed.length === 1 ? '' : 's'} had at least one missed shift.`
      : 'No missed assigned shifts were detected in the last 7 days.';

    return {
      intent: 'guards',
      answer,
      confidenceScore: 0.84,
      sources: missed
        .slice(0, 5)
        .map((row) =>
          this.source(
            'guard',
            row.guardId,
            row.guardName,
            `/guards/${row.guardId}`,
            `${row.missedShifts} missed shift${row.missedShifts === 1 ? '' : 's'}`,
          ),
        ),
      actions: missed
        .slice(0, 5)
        .map((row) =>
          this.action('View Guard', 'guard', `/guards/${row.guardId}`),
        ),
      knowledgeQuery: `${question} missed shifts attendance guards ${missed.map((row) => row.guardName).join(' ')}`,
      context: { missedShiftsLast7Days: missed },
    };
  }

  private async answerRevenueQuestion(
    tenantId: string,
    userId: string,
    normalized: string,
    question: string,
  ): Promise<CopilotStructuredResult> {
    if (/(forecast|growth|next month|quarter|annual)/.test(normalized)) {
      const revenue = await this.revenueInsightsService.getRevenueDashboard(
        tenantId,
        userId,
      );
      const answer = `Next month's revenue forecast is ${this.formatCurrency(revenue.forecast.nextMonthRevenue)}, with ${revenue.forecast.monthlyGrowthRate}% expected monthly growth and ${this.formatCurrency(revenue.forecast.expectedCollections)} expected collections. Confidence is ${revenue.forecast.confidence}.`;

      return {
        intent: 'revenue',
        answer,
        confidenceScore: 0.86,
        sources: [
          this.source(
            'revenue_forecast',
            null,
            'Revenue Forecast',
            '/ai-insights/revenue',
            revenue.forecast.methodology,
          ),
        ],
        actions: [
          this.action('Open Revenue AI', 'dashboard', '/ai-insights/revenue'),
        ],
        knowledgeQuery: `${question} revenue forecast collections growth`,
        context: { forecast: revenue.forecast },
      };
    }

    if (/(renewal|contract)/.test(normalized)) {
      const renewals =
        await this.revenueInsightsService.getRenewalOpportunities(
          tenantId,
          userId,
        );
      const rows = renewals.rows.slice(0, 5);
      const top = rows[0];
      const answer = top
        ? `${top.name} is the top renewal or contract opportunity. ${top.recommendation} Estimated revenue at risk is ${this.formatCurrency(top.estimatedRevenueAtRisk)}.`
        : 'No urgent renewal or contract opportunities are currently flagged.';

      return {
        intent: 'revenue',
        answer,
        confidenceScore: top ? 0.84 : 0.72,
        sources: rows.map((row) =>
          this.source(
            'client',
            row.clientId,
            row.name,
            `/clients/${row.clientId}`,
            row.reason,
          ),
        ),
        actions: rows.map((row) =>
          this.action('View Client', 'client', `/clients/${row.clientId}`),
        ),
        knowledgeQuery: `${question} renewal contract ${rows.map((row) => `${row.name} ${row.reason}`).join(' ')}`,
        context: { renewals: rows },
      };
    }

    const clientValue =
      await this.revenueInsightsService.getClientValueAnalysis(
        tenantId,
        userId,
      );
    const rows = [...clientValue.rows]
      .sort((left, right) => right.totalRevenue - left.totalRevenue)
      .slice(0, 5);
    const top = rows[0];
    const answer = top
      ? `${top.name} generates the highest revenue with ${this.formatCurrency(top.totalRevenue)}, representing ${top.revenueShare}% of tenant revenue.`
      : 'No client revenue data is available yet.';

    return {
      intent: 'clients',
      answer,
      confidenceScore: top ? 0.88 : 0.7,
      sources: rows.map((row) =>
        this.source(
          'client',
          row.clientId,
          row.name,
          `/clients/${row.clientId}`,
          `${this.formatCurrency(row.totalRevenue)} revenue, ${row.revenueShare}% share`,
        ),
      ),
      actions: rows.map((row) =>
        this.action('View Client', 'client', `/clients/${row.clientId}`),
      ),
      knowledgeQuery: `${question} highest revenue clients ${rows.map((row) => row.name).join(' ')}`,
      context: { clients: rows },
    };
  }

  private async answerReportsQuestion(
    tenantId: string,
    question: string,
  ): Promise<CopilotStructuredResult> {
    const reports = await this.prisma.dailyServiceReport.findMany({
      where: { tenantId },
      include: {
        client: { select: { id: true, name: true, companyName: true } },
        site: { select: { id: true, name: true } },
      },
      orderBy: [{ reportDate: 'desc' }, { createdAt: 'desc' }],
      take: 5,
    });

    const answer = reports.length
      ? `The latest daily service report is for ${reports[0].site.name} on ${reports[0].reportDate.toISOString().slice(0, 10)} with status ${reports[0].status}.`
      : 'No daily service reports were found for this tenant.';

    return {
      intent: 'reports',
      answer,
      confidenceScore: reports.length ? 0.82 : 0.68,
      sources: reports.map((report) =>
        this.source(
          'report',
          report.id,
          `${report.site.name} report`,
          `/reports/${report.id}`,
          `${report.status} - ${report.reportDate.toISOString().slice(0, 10)}`,
        ),
      ),
      actions: reports.map((report) =>
        this.action('View Report', 'report', `/reports/${report.id}`),
      ),
      knowledgeQuery: `${question} reports daily service ${reports.map((report) => report.site.name).join(' ')}`,
      context: { reports },
    };
  }

  private async answerGeneralQuestion(
    tenantId: string,
    userId: string,
    question: string,
  ): Promise<CopilotStructuredResult> {
    const [dashboard, revenue, scheduling] = await Promise.all([
      this.aiInsightsService.getDashboard(tenantId, userId),
      this.revenueInsightsService.getRevenueDashboard(tenantId, userId),
      this.recommendationService.getSchedulingOverview(tenantId),
    ]);

    const topRecommendation =
      dashboard.recommendations[0]?.action ||
      revenue.recommendations.recommendations[0]?.action ||
      scheduling.recommendations[0]?.action ||
      'Keep reviewing operations, incidents, staffing, and revenue weekly.';

    return {
      intent: 'general',
      answer: `The strongest current recommendation is: ${topRecommendation}`,
      confidenceScore: 0.72,
      sources: [
        this.source(
          'dashboard',
          null,
          'AI Insights',
          '/ai-insights',
          'Business insights dashboard',
        ),
        this.source(
          'dashboard',
          null,
          'Revenue AI',
          '/ai-insights/revenue',
          'Revenue intelligence dashboard',
        ),
      ],
      actions: [this.action('Open AI Insights', 'dashboard', '/ai-insights')],
      knowledgeQuery: question,
      context: {
        dashboardOverview: dashboard.overview,
        revenueForecast: revenue.forecast,
        scheduling,
      },
    };
  }

  private async getMissedShiftsLastWeek(tenantId: string) {
    const now = new Date();
    const start = new Date(now);
    start.setUTCDate(start.getUTCDate() - 7);

    const shifts = await this.prisma.shift.findMany({
      where: {
        tenantId,
        status: { not: 'cancelled' },
        endTime: { gte: start, lte: now },
      },
      include: {
        assignments: {
          include: {
            guard: { select: { id: true, name: true } },
          },
        },
        attendanceEvents: {
          where: { tenantId, type: 'CHECK_IN' },
          select: { guardId: true },
        },
      },
    });

    const rows = new Map<
      string,
      {
        guardId: string;
        guardName: string;
        missedShifts: number;
        shiftIds: string[];
      }
    >();
    shifts.forEach((shift) => {
      const checkedIn = new Set(
        shift.attendanceEvents.map((event) => event.guardId),
      );
      shift.assignments.forEach((assignment) => {
        if (checkedIn.has(assignment.guardId)) return;
        const row = rows.get(assignment.guardId) || {
          guardId: assignment.guardId,
          guardName: assignment.guard.name,
          missedShifts: 0,
          shiftIds: [],
        };
        row.missedShifts += 1;
        row.shiftIds.push(shift.id);
        rows.set(assignment.guardId, row);
      });
    });

    return Array.from(rows.values()).sort(
      (left, right) =>
        right.missedShifts - left.missedShifts ||
        left.guardName.localeCompare(right.guardName),
    );
  }

  private source(
    type: string,
    id: string | null | undefined,
    title: string,
    url?: string,
    snippet?: string,
  ): CopilotSourceReference {
    return { type, id, title, url, snippet };
  }

  private action(
    label: string,
    type: CopilotActionLink['type'],
    url: string,
  ): CopilotActionLink {
    return { label, type, url };
  }

  private clientName(
    client: { name: string; companyName?: string | null } | null,
  ) {
    if (!client) return 'Unknown client';
    return client.companyName || client.name;
  }

  private formatCurrency(value: number) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: value >= 1000 ? 0 : 2,
    }).format(value);
  }
}
