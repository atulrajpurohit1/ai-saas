import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { isCompActive } from '../billing/comp.util';
import {
  CREDIT_PACKS,
  CREDIT_PACK_KEYS,
} from '../billing/credit-packs.constants';
import { StripeService } from '../billing/stripe.service';
import { resolvePackageForModules } from '../billing/pricing.constants';

/** Default and maximum history, in months. */
const DEFAULT_MONTHS = 12;
const MAX_MONTHS = 36;

/**
 * How a tenant came by the credits on a PURCHASE ledger row.
 *
 * Derived from `stripe_session_id`, which carries a different shape per
 * channel and is therefore an exact classifier rather than a guess:
 *   - `cs_…`               a Checkout session: a pack bought by hand
 *   - `pi_…`               a PaymentIntent: an automatic top-up on a saved card
 *   - `leadgen-credits:…`  the credits bundled with a Lead Gen plan
 *   - null                 granted, not sold (Trial plan credits, admin grants)
 */
export type CreditChannel = 'pack' | 'recharge' | 'plan' | 'granted';

export const CREDIT_CHANNEL_LABELS: Record<CreditChannel, string> = {
  pack: 'Credit packs',
  recharge: 'Auto top-ups',
  plan: 'Included with plan',
  granted: 'Granted (not sold)',
};

export interface MonthlyRow {
  /** `YYYY-MM`, in UTC. */
  month: string;

  // --- Growth ---
  newTenants: number;
  newUsers: number;
  /**
   * Modules a tenant held for the first time this month. This is a feature
   * adoption metric, not a count of paid plan purchases.
   */
  moduleActivations: number;

  // --- Paid subscription invoices from Stripe ---
  planRevenueUsd: number;
  planPayments: number;
  newPlanPayments: number;
  renewalPayments: number;

  // --- Credits sold ---
  creditPurchases: number;
  creditsPurchased: number;
  creditsByChannel: Record<CreditChannel, number>;
  purchasesByChannel: Record<CreditChannel, number>;
  /** List-price value of the credits sold this month. See `approximations`. */
  creditRevenueUsd: number;
  /**
   * Sold purchases whose credit amount matches no pack in the catalogue, so
   * they contribute nothing to `creditRevenueUsd`.
   *
   * Reported rather than swallowed: without it a month of odd-sized grants
   * reads as $0 revenue with no indication that the figure is incomplete,
   * which is indistinguishable from a month with no sales. A non-zero count
   * here means repriced packs, hand-written ledger rows, or seeded data.
   */
  unpricedPurchases: number;

  // --- Credits spent, and what that work cost us ---
  creditsConsumed: number;
  searchesSettled: number;
  /** What BlackPearl actually charged us for the work. Real cost, not list. */
  upstreamCostUsd: number;

  // --- AI (Gemini) ---
  aiCalls: number;
  aiFailedCalls: number;
  aiInputTokens: number;
  aiOutputTokens: number;
  aiTotalTokens: number;
  aiCostUsd: number;

  // --- Auto-recharge health ---
  rechargeSucceeded: number;
  rechargeFailed: number;
  /** Exact: Stripe charged this, recorded on the attempt row. */
  rechargeRevenueUsd: number;
}

interface BucketRow {
  bucket: string;
}

/**
 * Monthly platform analytics for the owner's console.
 *
 * Usage figures are aggregated in Postgres with `date_trunc`, not fetched and
 * bucketed in Node: AiUsageEvent gets a row per AI call, so pulling a year of
 * them across to count tokens would get slower every month this page exists.
 * Paid plan invoices come from Stripe and are cached briefly.
 * Buckets are formatted with `to_char` server-side so no timezone conversion
 * happens on the way out -- the columns are `timestamp` holding UTC, and the
 * months are therefore UTC months.
 *
 * Counts and sums are cast to `::int` / `::float8` in SQL on purpose. Postgres
 * returns `COUNT(*)` and `SUM(int)` as bigint, which Prisma hands back as a
 * JS BigInt -- and `JSON.stringify` throws on BigInt, so an uncast aggregate
 * fails at the response serializer rather than here.
 *
 * TWO FIGURES ARE NOT EXACT, and are reported as such in `approximations`:
 *
 *  1. `moduleActivations` stands in for "plans bought". Nothing records a
 *     subscription purchase as an event: TenantSubscription is current state
 *     (one row per tenant, updated in place), so a purchase leaves no row and
 *     last March's plan sales are not reconstructible. TenantModule.createdAt
 *     is the nearest real event -- it is written when a tenant gains a module
 *     for the first time -- but a tenant who cancels and later re-subscribes
 *     to the same module is only toggled back to `isActive`, so a resubscribe
 *     is invisible here. An exact monthly record needs a subscription-event
 *     table written by the Stripe webhook.
 *  2. `creditRevenueUsd` is LIST price, derived from the pack sizes in
 *     credit-packs.constants.ts. Stripe remains the source of truth for what
 *     was actually charged (a discount or proration is invisible here).
 *     `rechargeRevenueUsd` is the exception -- that one is the real amount,
 *     because the attempt row records what Stripe charged.
 */
@Injectable()
export class PlatformAnalyticsService {
  private readonly logger = new Logger(PlatformAnalyticsService.name);
  private invoiceCache: {
    since: string;
    at: number;
    invoices: Awaited<ReturnType<StripeService['paidPlanInvoices']>>;
  } | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripe: StripeService,
  ) {}

  private async planInvoices(since: Date) {
    const key = since.toISOString();
    if (
      this.invoiceCache?.since === key &&
      Date.now() - this.invoiceCache.at < 5 * 60_000
    ) {
      return this.invoiceCache.invoices;
    }
    try {
      const invoices = await this.stripe.paidPlanInvoices(since);
      this.invoiceCache = { since: key, at: Date.now(), invoices };
      return invoices;
    } catch (error) {
      this.logger.warn(
        `Could not load paid plan invoices: ${(error as Error).message}`,
      );
      return null;
    }
  }

  /**
   * Credits -> list price, built from the pack table rather than hardcoded, so
   * a repricing in credit-packs.constants.ts moves this with it.
   *
   * Lead Gen's tiers carry the same credit sizes at the same credit-price
   * points, so one map serves both channels.
   */
  private creditPriceBySize(): Map<number, number> {
    return new Map(
      CREDIT_PACK_KEYS.map((key) => [
        CREDIT_PACKS[key].credits,
        CREDIT_PACKS[key].price,
      ]),
    );
  }

  async monthly(requestedMonths?: number) {
    const months = Math.min(
      Math.max(
        Math.trunc(requestedMonths ?? DEFAULT_MONTHS) || DEFAULT_MONTHS,
        1,
      ),
      MAX_MONTHS,
    );

    // First instant of the earliest month in range, UTC. Built from UTC parts
    // rather than by subtracting days, so a 31-day month cannot shift the
    // boundary into the wrong bucket.
    const now = new Date();
    const since = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1),
    );

    const [
      tenantRows,
      userRows,
      moduleRows,
      creditRows,
      consumptionRows,
      aiRows,
      rechargeRows,
      snapshot,
      breakdowns,
      planInvoices,
    ] = await Promise.all([
      this.newTenantsByMonth(since),
      this.newUsersByMonth(since),
      this.moduleActivationsByMonth(since),
      this.creditPurchasesByMonth(since),
      this.creditConsumptionByMonth(since),
      this.aiUsageByMonth(since),
      this.rechargesByMonth(since),
      this.snapshot(),
      this.breakdowns(since),
      this.planInvoices(since),
    ]);

    const series = this.emptySeries(months, now);
    const byMonth = new Map(series.map((row) => [row.month, row]));
    const priceBySize = this.creditPriceBySize();

    for (const row of tenantRows) {
      const target = byMonth.get(row.bucket);
      if (target) target.newTenants = row.n;
    }
    for (const row of userRows) {
      const target = byMonth.get(row.bucket);
      if (target) target.newUsers = row.n;
    }
    for (const row of moduleRows) {
      const target = byMonth.get(row.bucket);
      if (target) target.moduleActivations = row.n;
    }

    for (const row of creditRows) {
      const target = byMonth.get(row.bucket);
      if (!target) continue;
      const channel = row.channel as CreditChannel;
      target.creditsByChannel[channel] += row.credits;
      target.purchasesByChannel[channel] += row.purchases;
      target.creditsPurchased += row.credits;
      target.creditPurchases += row.purchases;
      // Priced per pack SIZE, which is why the query groups by amount: a month
      // holding one Starter and one Elite sale averages to a pack size that
      // does not exist, and pricing that average would invent a number.
      //
      // Sold channels only -- a granted Trial credit has no list price, and
      // counting one would overstate revenue.
      if (channel !== 'granted') {
        const unitPrice = priceBySize.get(row.packSize);
        if (unitPrice === undefined) target.unpricedPurchases += row.purchases;
        else target.creditRevenueUsd += unitPrice * row.purchases;
      }
    }

    for (const row of consumptionRows) {
      const target = byMonth.get(row.bucket);
      if (!target) continue;
      target.creditsConsumed = row.consumed;
      target.searchesSettled = row.searches;
      target.upstreamCostUsd = row.upstream;
    }

    for (const row of aiRows) {
      const target = byMonth.get(row.bucket);
      if (!target) continue;
      target.aiCalls = row.calls;
      target.aiFailedCalls = row.failed;
      target.aiInputTokens = row.input_tokens;
      target.aiOutputTokens = row.output_tokens;
      target.aiTotalTokens = row.total_tokens;
      target.aiCostUsd = row.cost;
    }

    for (const row of rechargeRows) {
      const target = byMonth.get(row.bucket);
      if (!target) continue;
      target.rechargeSucceeded = row.succeeded;
      target.rechargeFailed = row.failed;
      target.rechargeRevenueUsd = row.revenue;
    }

    for (const invoice of planInvoices ?? []) {
      const month = invoice.paidAt.toISOString().slice(0, 7);
      const target = byMonth.get(month);
      if (!target) continue;
      target.planRevenueUsd += invoice.amountUsd;
      target.planPayments += 1;
      if (invoice.reason === 'subscription_create') target.newPlanPayments += 1;
      if (invoice.reason === 'subscription_cycle') target.renewalPayments += 1;
    }

    return {
      generatedAt: new Date().toISOString(),
      months,
      timezone: 'UTC',
      series,
      snapshot,
      breakdowns,
      planRevenueAvailable: planInvoices !== null,
      approximations: {
        moduleActivations:
          'Counts modules a tenant held for the first time. Nothing records a ' +
          'subscription purchase as an event, so plan sales in past months are ' +
          'not reconstructible and a resubscribe to a module the tenant once ' +
          'had is not counted.',
        creditRevenueUsd:
          'List price, derived from the pack sizes. Stripe is the source of ' +
          'truth for what was actually charged. Credits bundled with plans overlap plan invoice revenue; do not add these totals. Auto top-up revenue is exact.',
      },
    };
  }

  /** One zero-filled row per month in range, oldest first. */
  private emptySeries(months: number, now: Date): MonthlyRow[] {
    const rows: MonthlyRow[] = [];
    for (let back = months - 1; back >= 0; back -= 1) {
      const date = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1),
      );
      const month = `${date.getUTCFullYear()}-${String(
        date.getUTCMonth() + 1,
      ).padStart(2, '0')}`;
      rows.push({
        month,
        newTenants: 0,
        newUsers: 0,
        moduleActivations: 0,
        creditPurchases: 0,
        creditsPurchased: 0,
        creditsByChannel: { pack: 0, recharge: 0, plan: 0, granted: 0 },
        purchasesByChannel: { pack: 0, recharge: 0, plan: 0, granted: 0 },
        creditRevenueUsd: 0,
        unpricedPurchases: 0,
        creditsConsumed: 0,
        searchesSettled: 0,
        upstreamCostUsd: 0,
        aiCalls: 0,
        aiFailedCalls: 0,
        aiInputTokens: 0,
        aiOutputTokens: 0,
        aiTotalTokens: 0,
        aiCostUsd: 0,
        rechargeSucceeded: 0,
        rechargeFailed: 0,
        rechargeRevenueUsd: 0,
        planRevenueUsd: 0,
        planPayments: 0,
        newPlanPayments: 0,
        renewalPayments: 0,
      });
    }
    return rows;
  }

  /**
   * New accounts per month, counting only tenants with a verified user.
   *
   * Same filter the rest of the console uses: a self-service signup creates
   * the tenant row before the owner confirms their email, so an abandoned
   * signup would otherwise show up here as a new customer.
   */
  private newTenantsByMonth(since: Date) {
    return this.prisma.$queryRaw<(BucketRow & { n: number })[]>(Prisma.sql`
      SELECT to_char(date_trunc('month', t."createdAt"), 'YYYY-MM') AS bucket,
             COUNT(*)::int AS n
      FROM "Tenant" t
      WHERE t."createdAt" >= ${since}
        AND EXISTS (
          SELECT 1 FROM "User" u
          WHERE u."tenantId" = t."id" AND u."email_verified" = true
        )
      GROUP BY 1
    `);
  }

  private newUsersByMonth(since: Date) {
    return this.prisma.$queryRaw<(BucketRow & { n: number })[]>(Prisma.sql`
      SELECT to_char(date_trunc('month', u."createdAt"), 'YYYY-MM') AS bucket,
             COUNT(*)::int AS n
      FROM "User" u
      WHERE u."createdAt" >= ${since} AND u."email_verified" = true
      GROUP BY 1
    `);
  }

  private moduleActivationsByMonth(since: Date) {
    return this.prisma.$queryRaw<(BucketRow & { n: number })[]>(Prisma.sql`
      SELECT to_char(date_trunc('month', "created_at"), 'YYYY-MM') AS bucket,
             COUNT(*)::int AS n
      FROM "TenantModule"
      WHERE "created_at" >= ${since}
      GROUP BY 1
    `);
  }

  /**
   * Credits sold per month, split by how they were sold.
   *
   * `amount > 0` excludes the reversal rows a refund writes, which are also
   * PURCHASE-typed but negative -- counting them would net a refund against a
   * genuine sale inside one bucket and hide both.
   *
   * Enum columns are compared as `::text` so the literal does not depend on
   * Postgres inferring the enum type for a parameterless comparison.
   */
  private creditPurchasesByMonth(since: Date) {
    return this.prisma.$queryRaw<
      (BucketRow & {
        channel: string;
        packSize: number;
        purchases: number;
        credits: number;
      })[]
    >(Prisma.sql`
      SELECT to_char(date_trunc('month', "created_at"), 'YYYY-MM') AS bucket,
             CASE
               WHEN "type"::text = 'ADJUSTMENT' THEN 'granted'
               WHEN "stripe_session_id" LIKE 'cs_%' THEN 'pack'
               WHEN "stripe_session_id" LIKE 'pi_%' THEN 'recharge'
               WHEN "stripe_session_id" LIKE 'leadgen-credits:%' THEN 'plan'
               ELSE 'granted'
             END AS channel,
             "amount"::int AS "packSize",
             COUNT(*)::int AS purchases,
             COALESCE(SUM("amount"), 0)::int AS credits
      FROM "CreditLedgerEntry"
      WHERE "type"::text IN ('PURCHASE', 'ADJUSTMENT')
        AND "amount" > 0
        AND "created_at" >= ${since}
      GROUP BY 1, 2, 3
    `);
  }

  /**
   * Credits actually spent, and what the upstream work cost us.
   *
   * Read off SETTLED reservations rather than by summing negative amounts: the
   * reservation holds the requested cost up front and `settled_amount` is what
   * the job turned out to consume, so the reservation amount would overstate
   * spend on every job that released part of its hold.
   */
  private creditConsumptionByMonth(since: Date) {
    return this.prisma.$queryRaw<
      (BucketRow & { consumed: number; searches: number; upstream: number })[]
    >(Prisma.sql`
      SELECT to_char(date_trunc('month', "created_at"), 'YYYY-MM') AS bucket,
             COALESCE(SUM("settled_amount"), 0)::int AS consumed,
             COUNT(*)::int AS searches,
             COALESCE(SUM("upstream_cost_usd"), 0)::float8 AS upstream
      FROM "CreditLedgerEntry"
      WHERE "type"::text = 'RESERVATION'
        AND "reservation_status"::text = 'SETTLED'
        AND "created_at" >= ${since}
      GROUP BY 1
    `);
  }

  /**
   * AI calls, tokens and cost per month.
   *
   * Token columns are nullable (a response without usage metadata), and
   * SUM ignores nulls -- which is right: a missing count must not read as
   * zero tokens, and COALESCE only guards the all-null case.
   */
  private aiUsageByMonth(since: Date) {
    return this.prisma.$queryRaw<
      (BucketRow & {
        calls: number;
        failed: number;
        input_tokens: number;
        output_tokens: number;
        total_tokens: number;
        cost: number;
      })[]
    >(Prisma.sql`
      SELECT to_char(date_trunc('month', "created_at"), 'YYYY-MM') AS bucket,
             COUNT(*)::int AS calls,
             (COUNT(*) FILTER (WHERE "succeeded" = false))::int AS failed,
             COALESCE(SUM("input_tokens"), 0)::float8 AS input_tokens,
             COALESCE(SUM("output_tokens"), 0)::float8 AS output_tokens,
             COALESCE(SUM("total_tokens"), 0)::float8 AS total_tokens,
             COALESCE(SUM("estimated_cost_usd"), 0)::float8 AS cost
      FROM "AiUsageEvent"
      WHERE "created_at" >= ${since}
      GROUP BY 1
    `);
  }

  private rechargesByMonth(since: Date) {
    return this.prisma.$queryRaw<
      (BucketRow & { succeeded: number; failed: number; revenue: number })[]
    >(Prisma.sql`
      SELECT to_char(date_trunc('month', "created_at"), 'YYYY-MM') AS bucket,
             (COUNT(*) FILTER (WHERE "status"::text = 'SUCCEEDED'))::int AS succeeded,
             (COUNT(*) FILTER (WHERE "status"::text = 'FAILED'))::int AS failed,
             COALESCE(
               SUM("amount_charged") FILTER (WHERE "status"::text = 'SUCCEEDED'),
               0
             )::float8 AS revenue
      FROM "CreditAutoRechargeAttempt"
      WHERE "created_at" >= ${since}
      GROUP BY 1
    `);
  }

  /** Where the platform stands right now, rather than over a window. */
  private async snapshot() {
    const [tenants, users, suspended, credits, subscriptions, aiLifetime] =
      await Promise.all([
        this.prisma.tenant.count({
          where: { users: { some: { emailVerified: true } } },
        }),
        this.prisma.user.count({ where: { emailVerified: true } }),
        this.prisma.tenant.count({
          where: { isActive: false, users: { some: { emailVerified: true } } },
        }),
        this.prisma.tenantCreditBalance.aggregate({
          _sum: {
            balance: true,
            lifetimePurchased: true,
            lifetimeConsumed: true,
          },
        }),
        this.prisma.tenantSubscription.findMany({
          // Verified tenants only, matching the `tenants` count above. Without
          // this the plan mix counts subscriptions belonging to abandoned
          // signups too -- on the dev branch that read "47 plans" beside
          // "17 tenants", which is the kind of disagreement that makes a
          // whole dashboard untrustworthy.
          where: { tenant: { users: { some: { emailVerified: true } } } },
          select: {
            status: true,
            source: true,
            aiEnabled: true,
            compExpiresAt: true,
            providerSubscriptionId: true,
            tenant: {
              select: {
                modules: {
                  where: { isActive: true },
                  select: { module: true },
                },
              },
            },
          },
        }),
        this.prisma.aiUsageEvent.aggregate({
          _sum: { totalTokens: true, estimatedCostUsd: true },
          _count: { _all: true },
        }),
      ]);

    // Same classification as the overview card, so the two screens cannot
    // disagree about how many tenants are paying.
    let paying = 0;
    let trial = 0;
    let comped = 0;
    let none = 0;
    const payingByPackage = {
      GENERATION: 0,
      GUARD: 0,
      OPERATIONS: 0,
      COMPLETE: 0,
      OTHER: 0,
    };
    let leadGenAddOns = 0;
    for (const sub of subscriptions) {
      const liveComp =
        sub.source === 'COMP' &&
        isCompActive({
          source: sub.source,
          status: sub.status,
          compExpiresAt: sub.compExpiresAt,
        });
      if (
        sub.source === 'STRIPE' &&
        sub.status !== 'CANCELED' &&
        sub.providerSubscriptionId
      ) {
        paying += 1;
        const resolved = resolvePackageForModules(
          (sub.tenant?.modules ?? []).map((row) => row.module),
        );
        payingByPackage[resolved.packageKey ?? 'OTHER'] += 1;
        if (resolved.leadGenAddOn) leadGenAddOns += 1;
      } else if (liveComp && sub.aiEnabled) comped += 1;
      else if (liveComp && !sub.aiEnabled) trial += 1;
      else none += 1;
    }

    return {
      tenants,
      users,
      suspendedTenants: suspended,
      planMix: { paying, trial, comped, none },
      payingByPackage,
      leadGenAddOns,
      creditsOutstanding: credits._sum.balance ?? 0,
      creditsPurchasedLifetime: credits._sum.lifetimePurchased ?? 0,
      creditsConsumedLifetime: credits._sum.lifetimeConsumed ?? 0,
      aiCallsLifetime: aiLifetime._count._all,
      aiTokensLifetime: aiLifetime._sum.totalTokens ?? 0,
      aiCostUsdLifetime: Number(aiLifetime._sum.estimatedCostUsd ?? 0),
    };
  }

  /** Rankings over the whole window, for the tables beneath the charts. */
  private async breakdowns(since: Date) {
    const [byFeature, byModel, topTenants] = await Promise.all([
      this.prisma.$queryRaw<
        {
          feature: string;
          calls: number;
          failed: number;
          tokens: number;
          cost: number;
        }[]
      >(Prisma.sql`
        SELECT "feature"::text AS feature,
               COUNT(*)::int AS calls,
               (COUNT(*) FILTER (WHERE "succeeded" = false))::int AS failed,
               COALESCE(SUM("total_tokens"), 0)::float8 AS tokens,
               COALESCE(SUM("estimated_cost_usd"), 0)::float8 AS cost
        FROM "AiUsageEvent"
        WHERE "created_at" >= ${since}
        GROUP BY 1
        ORDER BY cost DESC
      `),
      this.prisma.$queryRaw<
        { model: string; calls: number; tokens: number; cost: number }[]
      >(Prisma.sql`
        SELECT "model" AS model,
               COUNT(*)::int AS calls,
               COALESCE(SUM("total_tokens"), 0)::float8 AS tokens,
               COALESCE(SUM("estimated_cost_usd"), 0)::float8 AS cost
        FROM "AiUsageEvent"
        WHERE "created_at" >= ${since}
        GROUP BY 1
        ORDER BY cost DESC
      `),
      this.prisma.$queryRaw<
        {
          tenantId: string;
          name: string;
          credits: number;
          purchases: number;
        }[]
      >(Prisma.sql`
        SELECT l."tenant_id" AS "tenantId",
               t."name" AS name,
               COALESCE(SUM(l."amount"), 0)::int AS credits,
               COUNT(*)::int AS purchases
        FROM "CreditLedgerEntry" l
        JOIN "Tenant" t ON t."id" = l."tenant_id"
        WHERE l."type"::text = 'PURCHASE'
          AND l."amount" > 0
          AND l."stripe_session_id" IS NOT NULL
          AND l."created_at" >= ${since}
        GROUP BY 1, 2
        ORDER BY credits DESC
        LIMIT 15
      `),
    ]);

    return { aiByFeature: byFeature, aiByModel: byModel, topTenants };
  }
}
