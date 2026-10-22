import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiUsageService } from '../ai/ai-usage.service';
import { isCompActive } from '../billing/comp.util';

/** How far back the usage figures on the overview look, in days. */
const USAGE_WINDOW_DAYS = 30;

function windowStart(days = USAGE_WINDOW_DAYS): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

/**
 * Read-only, cross-tenant reporting for the platform owner.
 *
 * Everything here answers "how is the whole platform doing" -- which tenants
 * are on which plan, who is spending credits, what AI is costing us -- so it is
 * reached only through the PlatformAdminGuard, never tenant-scoped. It writes
 * nothing; the write actions (granting and revoking access) stay in
 * CompController.
 */
@Injectable()
export class PlatformMonitoringService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiUsage: AiUsageService,
  ) {}

  /** Headline counts and totals for the top of the dashboard. */
  async overview() {
    const since = windowStart();

    const [tenantCount, subscriptions, creditTotals, aiSpend] =
      await Promise.all([
        this.prisma.tenant.count(),
        this.prisma.tenantSubscription.findMany({
          select: {
            status: true,
            source: true,
            aiEnabled: true,
            compExpiresAt: true,
          },
        }),
        this.prisma.tenantCreditBalance.aggregate({
          _sum: { balance: true },
        }),
        this.prisma.aiUsageEvent.aggregate({
          where: { createdAt: { gte: since } },
          _sum: { estimatedCostUsd: true },
          _count: { _all: true },
        }),
      ]);

    // A Trial plan is a live comp with AI off; a comped paid plan is a live
    // comp with AI on. Lapsed/cancelled comps count as neither.
    let paying = 0;
    let trial = 0;
    let compedPaid = 0;
    for (const sub of subscriptions) {
      const liveComp =
        sub.source === 'COMP' &&
        isCompActive({
          source: sub.source,
          status: sub.status,
          compExpiresAt: sub.compExpiresAt,
        });
      if (sub.source === 'STRIPE' && sub.status !== 'CANCELED') paying += 1;
      else if (liveComp && sub.aiEnabled) compedPaid += 1;
      else if (liveComp && !sub.aiEnabled) trial += 1;
    }

    return {
      tenants: tenantCount,
      subscriptions: {
        paying,
        trial,
        compedPaid,
      },
      creditsOutstanding: creditTotals._sum.balance ?? 0,
      ai: {
        windowDays: USAGE_WINDOW_DAYS,
        costUsd: Number(aiSpend._sum.estimatedCostUsd ?? 0),
        calls: aiSpend._count._all,
      },
    };
  }

  /**
   * Every tenant with its plan, credit balance and recent AI spend. The screen
   * uses this both to monitor and to pick a tenant to grant the Trial plan.
   */
  async tenants() {
    const since = windowStart();

    const [tenants, aiByTenant] = await Promise.all([
      this.prisma.tenant.findMany({
        select: {
          id: true,
          name: true,
          createdAt: true,
          isActive: true,
          suspendedAt: true,
          suspendedReason: true,
          slug: true,
          _count: { select: { users: true } },
          subscription: {
            select: {
              status: true,
              source: true,
              aiEnabled: true,
              compExpiresAt: true,
              compReason: true,
            },
          },
          creditBalance: {
            select: { balance: true, lifetimeConsumed: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.aiUsage.getTopTenantsByCost({ since, limit: 10_000 }),
    ]);

    const costByTenant = new Map(
      aiByTenant.map((row) => [row.tenantId, row.costUsd]),
    );

    return tenants.map((tenant) => {
      const sub = tenant.subscription;
      const liveComp =
        !!sub &&
        sub.source === 'COMP' &&
        isCompActive({
          source: sub.source,
          status: sub.status,
          compExpiresAt: sub.compExpiresAt,
        });

      return {
        tenantId: tenant.id,
        name: tenant.name,
        createdAt: tenant.createdAt,
        slug: tenant.slug,
        isActive: tenant.isActive,
        suspendedAt: tenant.suspendedAt,
        suspendedReason: tenant.suspendedReason,
        userCount: tenant._count.users,
        status: sub?.status ?? null,
        source: sub?.source ?? null,
        // The plan label the screen shows: a live comp with AI off is the
        // Trial plan; everything else follows the subscription source.
        plan: !sub
          ? 'NONE'
          : liveComp
            ? sub.aiEnabled
              ? 'COMP'
              : 'TRIAL'
            : sub.source,
        aiEnabled: sub?.aiEnabled ?? false,
        compExpiresAt: liveComp ? sub.compExpiresAt : null,
        compReason: liveComp ? sub.compReason : null,
        creditBalance: tenant.creditBalance?.balance ?? 0,
        creditsConsumed: tenant.creditBalance?.lifetimeConsumed ?? 0,
        aiCostUsd30d: costByTenant.get(tenant.id) ?? 0,
      };
    });
  }

  /** AI spend broken down by feature and by tenant, over the window. */
  async aiUsageBreakdown(days = USAGE_WINDOW_DAYS) {
    const since = windowStart(days);
    const [byFeature, topTenants] = await Promise.all([
      this.aiUsage.getFeatureCostSummary({ since }),
      this.aiUsage.getTopTenantsByCost({ since, limit: 20 }),
    ]);

    // Resolve tenant names for the top spenders, so the screen shows a name
    // rather than a raw id. A null tenantId is system/unattributed spend.
    const ids = topTenants
      .map((row) => row.tenantId)
      .filter((id): id is string => !!id);
    const names = ids.length
      ? await this.prisma.tenant.findMany({
          where: { id: { in: ids } },
          select: { id: true, name: true },
        })
      : [];
    const nameById = new Map(names.map((t) => [t.id, t.name]));

    return {
      windowDays: days,
      byFeature,
      topTenants: topTenants.map((row) => ({
        tenantId: row.tenantId,
        name: row.tenantId
          ? (nameById.get(row.tenantId) ?? '(deleted tenant)')
          : '(system / unattributed)',
        costUsd: row.costUsd,
        calls: row.calls,
      })),
    };
  }

  /** The most recent credit auto-recharge attempts across all tenants. */
  async recharges(limit = 50) {
    const attempts = await this.prisma.creditAutoRechargeAttempt.findMany({
      take: Math.min(Math.max(limit, 1), 200),
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        tenantId: true,
        status: true,
        packKey: true,
        amountCharged: true,
        creditsGranted: true,
        balanceAtTrigger: true,
        failureReason: true,
        createdAt: true,
      },
    });

    // The attempt row holds no tenant relation, only the id, so names are
    // looked up in one batch.
    const ids = [...new Set(attempts.map((a) => a.tenantId))];
    const names = ids.length
      ? await this.prisma.tenant.findMany({
          where: { id: { in: ids } },
          select: { id: true, name: true },
        })
      : [];
    const nameById = new Map(names.map((t) => [t.id, t.name]));

    return attempts.map((attempt) => ({
      id: attempt.id,
      tenantId: attempt.tenantId,
      tenantName: nameById.get(attempt.tenantId) ?? null,
      status: attempt.status,
      packKey: attempt.packKey,
      amountCharged: attempt.amountCharged,
      creditsGranted: attempt.creditsGranted,
      balanceAtTrigger: attempt.balanceAtTrigger,
      failureReason: attempt.failureReason,
      createdAt: attempt.createdAt,
    }));
  }
}
