import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiUsageService } from '../ai/ai-usage.service';
import { isCompActive } from '../billing/comp.util';
import {
  COMP_PLAN_LABELS,
  compPlanOf,
} from '../billing/comp-plan.constants';
import { PACKAGE_LABELS, packageForModules } from '../billing/pricing.constants';

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
        // Mirror the tenants() filter: an abandoned signup (no verified user)
        // is not a real tenant and must not inflate the headline count.
        this.prisma.tenant.count({
          where: { users: { some: { emailVerified: true } } },
        }),
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
        // Only tenants that have at least one verified user. A self-service
        // signup creates the tenant row up front and attaches the OTP to it,
        // so an abandoned signup -- someone who never entered the code, or
        // changed their email and started over -- leaves a tenant whose only
        // user is unverified. Those are not real accounts (an unverified user
        // cannot even log in), so they must not show up here as tenants. A
        // platform-created tenant and any completed signup both have a
        // verified user, so this keeps every genuine account.
        where: { users: { some: { emailVerified: true } } },
        select: {
          id: true,
          name: true,
          createdAt: true,
          isActive: true,
          suspendedAt: true,
          suspendedReason: true,
          slug: true,
          ownerUserId: true,
          _count: { select: { users: true } },
          // ownerUserId is a plain column, not a relation, so the owner's
          // email is read from the user list rather than a nested owner
          // select. Few users per tenant at this scale, so this is cheap.
          users: {
            select: { id: true, email: true, emailVerified: true },
            orderBy: { createdAt: 'asc' },
          },
          subscription: {
            select: {
              status: true,
              source: true,
              aiEnabled: true,
              compExpiresAt: true,
              compPlan: true,
              compReason: true,
            },
          },
          // Needed to name a PAYING tenant's package, which has nowhere else
          // to come from here -- a comp records its plan on the subscription,
          // a Stripe one does not.
          modules: { where: { isActive: true }, select: { module: true } },
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

      // The account's email, for the Tenants table. Prefer the founding
      // owner; fall back to the first verified user, then the first user, so
      // a legacy tenant with no recorded owner still shows something.
      const ownerEmail =
        tenant.users.find((u) => u.id === tenant.ownerUserId)?.email ??
        tenant.users.find((u) => u.emailVerified)?.email ??
        tenant.users[0]?.email ??
        null;

      return {
        tenantId: tenant.id,
        name: tenant.name,
        email: ownerEmail,
        createdAt: tenant.createdAt,
        slug: tenant.slug,
        isActive: tenant.isActive,
        suspendedAt: tenant.suspendedAt,
        suspendedReason: tenant.suspendedReason,
        userCount: tenant._count.users,
        status: sub?.status ?? null,
        source: sub?.source ?? null,
        // How the tenant came by their access -- paying, comped, or nothing.
        // Kept because the screen colours the row by it, but it is no longer
        // what the badge says: see planName.
        plan: !sub
          ? 'NONE'
          : liveComp
            ? sub.aiEnabled
              ? 'COMP'
              : 'TRIAL'
            : sub.source,
        // WHICH plan, by name. The screen used to show the line above, so
        // every comped tenant read "Comped" whether they had been given
        // Operations or the entire product.
        //
        // A live comp is named from the plan recorded on the grant; anyone
        // else is named from the modules they hold, which is unambiguous once
        // Trial is off the table (it is the collision, and it is always a
        // comp). Null when there is no plan to name, and the screen falls back
        // to the kind of access.
        planName: !sub
          ? null
          : liveComp
            ? (() => {
                const granted = compPlanOf(sub);
                return granted ? COMP_PLAN_LABELS[granted] : null;
              })()
            : (() => {
                const packageKey = packageForModules(
                  (tenant.modules ?? []).map((row) => row.module),
                );
                return packageKey ? PACKAGE_LABELS[packageKey] : null;
              })(),
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
