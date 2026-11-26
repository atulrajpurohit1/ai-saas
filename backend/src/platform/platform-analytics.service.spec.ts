import { PlatformAnalyticsService } from './platform-analytics.service';
import { PrismaService } from '../prisma/prisma.service';
import { StripeService } from '../billing/stripe.service';

/**
 * The service issues several raw queries in one Promise.all, so the mock
 * dispatches on the SQL text rather than on call order -- which would silently
 * mis-assign every result the moment a query is added or reordered.
 */
type RawFixtures = {
  tenants?: unknown[];
  users?: unknown[];
  modules?: unknown[];
  credits?: unknown[];
  consumption?: unknown[];
  ai?: unknown[];
  recharges?: unknown[];
  aiByFeature?: unknown[];
  aiByModel?: unknown[];
  topTenants?: unknown[];
};

function build(
  fixtures: RawFixtures = {},
  invoices: Awaited<ReturnType<StripeService['paidPlanInvoices']>> = [],
) {
  const queryRaw = jest.fn((sql: { strings?: string[]; text?: string }) => {
    const text = (sql.text ?? sql.strings?.join(' ') ?? '').replace(
      /\s+/g,
      ' ',
    );

    if (text.includes('FROM "Tenant" t'))
      return Promise.resolve(fixtures.tenants ?? []);
    if (text.includes('FROM "User" u'))
      return Promise.resolve(fixtures.users ?? []);
    if (text.includes('FROM "TenantModule"'))
      return Promise.resolve(fixtures.modules ?? []);
    if (text.includes('FROM "CreditLedgerEntry" l'))
      return Promise.resolve(fixtures.topTenants ?? []);
    if (text.includes("'PURCHASE'"))
      return Promise.resolve(fixtures.credits ?? []);
    if (text.includes("'RESERVATION'"))
      return Promise.resolve(fixtures.consumption ?? []);
    if (text.includes('"feature"::text'))
      return Promise.resolve(fixtures.aiByFeature ?? []);
    if (text.includes('"model" AS model'))
      return Promise.resolve(fixtures.aiByModel ?? []);
    if (text.includes('FROM "AiUsageEvent"'))
      return Promise.resolve(fixtures.ai ?? []);
    if (text.includes('FROM "CreditAutoRechargeAttempt"'))
      return Promise.resolve(fixtures.recharges ?? []);

    throw new Error(`Unexpected query in test: ${text.slice(0, 120)}`);
  });

  const prisma = {
    $queryRaw: queryRaw,
    tenant: { count: jest.fn().mockResolvedValue(0) },
    user: { count: jest.fn().mockResolvedValue(0) },
    tenantCreditBalance: {
      aggregate: jest.fn().mockResolvedValue({ _sum: {} }),
    },
    tenantSubscription: { findMany: jest.fn().mockResolvedValue([]) },
    aiUsageEvent: {
      aggregate: jest.fn().mockResolvedValue({ _sum: {}, _count: { _all: 0 } }),
    },
  } as unknown as PrismaService;

  const stripe = {
    paidPlanInvoices: jest.fn().mockResolvedValue(invoices),
  } as unknown as StripeService;
  return {
    service: new PlatformAnalyticsService(prisma, stripe),
    prisma,
    queryRaw,
    stripe,
  };
}

/** The `YYYY-MM` key for `back` months before now, in UTC. */
function monthKey(back: number): string {
  const now = new Date();
  const date = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1),
  );
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

describe('PlatformAnalyticsService', () => {
  it('groups paid plan invoices by payment month and event type', async () => {
    const paidAt = new Date(`${monthKey(0)}-10T12:00:00.000Z`);
    const { service } = build({}, [
      { id: 'in_new', paidAt, amountUsd: 548, reason: 'subscription_create' },
      { id: 'in_renew', paidAt, amountUsd: 299, reason: 'subscription_cycle' },
      { id: 'in_change', paidAt, amountUsd: 50, reason: 'subscription_update' },
    ]);
    const result = await service.monthly(1);

    expect(result.planRevenueAvailable).toBe(true);
    expect(result.series[0]).toMatchObject({
      planRevenueUsd: 897,
      planPayments: 3,
      newPlanPayments: 1,
      renewalPayments: 1,
    });
  });

  it('marks plan revenue unavailable when Stripe cannot be read', async () => {
    const { service } = build({}, null);
    const result = await service.monthly(1);
    expect(result.planRevenueAvailable).toBe(false);
  });
  describe('the month window', () => {
    it('returns one zero-filled row per month, oldest first', async () => {
      const { service } = build();
      const result = await service.monthly(6);

      expect(result.series).toHaveLength(6);
      expect(result.series[0].month).toBe(monthKey(5));
      expect(result.series[5].month).toBe(monthKey(0));
      // A month with no activity is a row of zeros, not a gap: a chart with
      // missing months would compress the x-axis and misread the trend.
      expect(result.series[2]).toMatchObject({
        newTenants: 0,
        creditsPurchased: 0,
        aiTotalTokens: 0,
      });
    });

    it('clamps an absurd window rather than scanning everything', async () => {
      const { service } = build();
      expect((await service.monthly(9999)).months).toBe(36);
      expect((await service.monthly(0)).months).toBe(12);
      expect((await service.monthly(-5)).months).toBe(1);
      expect((await service.monthly()).months).toBe(12);
    });

    // A bucket for a month outside the window must not be written anywhere --
    // silently folding it into the nearest row would overstate that month.
    it('ignores a bucket that falls outside the window', async () => {
      const { service } = build({
        tenants: [
          { bucket: monthKey(0), n: 4 },
          { bucket: '1999-01', n: 99 },
        ],
      });
      const result = await service.monthly(3);

      expect(result.series[2].newTenants).toBe(4);
      expect(result.series.reduce((sum, r) => sum + r.newTenants, 0)).toBe(4);
    });
  });

  describe('credit revenue', () => {
    // The bug this guards: grouping only by month and channel and then
    // dividing credits by purchase count produces an average pack size. One
    // Starter (3,000) plus one Elite (23,000) averages to 13,000 -- a Pro --
    // and prices the month at 2x$249 instead of $149+$349.
    it('prices each pack size separately rather than an average', async () => {
      const { service } = build({
        credits: [
          {
            bucket: monthKey(0),
            channel: 'pack',
            packSize: 3000,
            purchases: 1,
            credits: 3000,
          },
          {
            bucket: monthKey(0),
            channel: 'pack',
            packSize: 23000,
            purchases: 1,
            credits: 23000,
          },
        ],
      });
      const row = (await service.monthly(1)).series[0];

      expect(row.creditRevenueUsd).toBe(149 + 349);
      expect(row.creditsPurchased).toBe(26000);
      expect(row.creditPurchases).toBe(2);
      expect(row.unpricedPurchases).toBe(0);
    });

    it('multiplies by the number of purchases at that size', async () => {
      const { service } = build({
        credits: [
          {
            bucket: monthKey(0),
            channel: 'pack',
            packSize: 13000,
            purchases: 3,
            credits: 39000,
          },
        ],
      });
      expect((await service.monthly(1)).series[0].creditRevenueUsd).toBe(
        3 * 249,
      );
    });

    // Granted credits were never sold. Pricing them would invent revenue.
    it('excludes granted credits from revenue but still counts them', async () => {
      const { service } = build({
        credits: [
          {
            bucket: monthKey(0),
            channel: 'granted',
            packSize: 3000,
            purchases: 1,
            credits: 3000,
          },
        ],
      });
      const row = (await service.monthly(1)).series[0];

      expect(row.creditRevenueUsd).toBe(0);
      expect(row.creditsByChannel.granted).toBe(3000);
      expect(row.creditsPurchased).toBe(3000);
      // Not unpriced -- it is deliberately unsold, which is a different fact.
      expect(row.unpricedPurchases).toBe(0);
    });

    /**
     * A sold purchase whose size matches no pack contributes nothing to
     * revenue. Reported, because $0 revenue beside a month of real sales is
     * otherwise indistinguishable from a month with no sales at all -- which
     * is exactly what the dev database looked like.
     */
    it('counts a sold purchase it cannot price instead of silently dropping it', async () => {
      const { service } = build({
        credits: [
          {
            bucket: monthKey(0),
            channel: 'pack',
            packSize: 250,
            purchases: 2,
            credits: 500,
          },
        ],
      });
      const row = (await service.monthly(1)).series[0];

      expect(row.creditRevenueUsd).toBe(0);
      expect(row.unpricedPurchases).toBe(2);
      expect(row.creditsPurchased).toBe(500);
    });

    it('splits credits across the channel they arrived by', async () => {
      const { service } = build({
        credits: [
          {
            bucket: monthKey(0),
            channel: 'pack',
            packSize: 3000,
            purchases: 1,
            credits: 3000,
          },
          {
            bucket: monthKey(0),
            channel: 'recharge',
            packSize: 3000,
            purchases: 2,
            credits: 6000,
          },
          {
            bucket: monthKey(0),
            channel: 'plan',
            packSize: 13000,
            purchases: 1,
            credits: 13000,
          },
          {
            bucket: monthKey(0),
            channel: 'granted',
            packSize: 50,
            purchases: 4,
            credits: 200,
          },
        ],
      });
      const row = (await service.monthly(1)).series[0];

      expect(row.creditsByChannel).toEqual({
        pack: 3000,
        recharge: 6000,
        plan: 13000,
        granted: 200,
      });
      expect(row.purchasesByChannel).toEqual({
        pack: 1,
        recharge: 2,
        plan: 1,
        granted: 4,
      });
      expect(row.creditPurchases).toBe(8);
    });
  });

  describe('merging the other sources', () => {
    it('places every metric in the right month', async () => {
      const thisMonth = monthKey(0);
      const lastMonth = monthKey(1);
      const { service } = build({
        tenants: [{ bucket: lastMonth, n: 3 }],
        users: [{ bucket: lastMonth, n: 7 }],
        modules: [{ bucket: thisMonth, n: 9 }],
        consumption: [
          { bucket: thisMonth, consumed: 400, searches: 2, upstream: 1.25 },
        ],
        ai: [
          {
            bucket: thisMonth,
            calls: 120,
            failed: 4,
            input_tokens: 90_000,
            output_tokens: 30_000,
            total_tokens: 120_000,
            cost: 0.42,
          },
        ],
        recharges: [
          { bucket: lastMonth, succeeded: 2, failed: 1, revenue: 498 },
        ],
      });

      const [previous, current] = (await service.monthly(2)).series;

      expect(previous).toMatchObject({
        month: lastMonth,
        newTenants: 3,
        newUsers: 7,
        rechargeSucceeded: 2,
        rechargeFailed: 1,
        rechargeRevenueUsd: 498,
      });
      expect(current).toMatchObject({
        month: thisMonth,
        moduleActivations: 9,
        creditsConsumed: 400,
        searchesSettled: 2,
        upstreamCostUsd: 1.25,
        aiCalls: 120,
        aiFailedCalls: 4,
        aiInputTokens: 90_000,
        aiOutputTokens: 30_000,
        aiTotalTokens: 120_000,
        aiCostUsd: 0.42,
      });
      // Metrics must not bleed between months.
      expect(current.newTenants).toBe(0);
      expect(previous.aiCalls).toBe(0);
    });
  });

  describe('the snapshot', () => {
    it('shows which packages paying tenants hold, including Lead Gen add-ons', async () => {
      const { service, prisma } = build();
      (prisma.tenantSubscription.findMany as jest.Mock).mockResolvedValue([
        {
          source: 'STRIPE',
          status: 'ACTIVE',
          providerSubscriptionId: 'sub_guard',
          tenant: {
            modules: [{ module: 'GUARD_TOUR' }, { module: 'LEAD_GEN' }],
          },
        },
        {
          source: 'STRIPE',
          status: 'ACTIVE',
          providerSubscriptionId: 'sub_complete',
          tenant: {
            modules: [
              { module: 'GUARD_TOUR' },
              { module: 'LEAD_GEN' },
              { module: 'FINANCE' },
            ],
          },
        },
      ]);

      const { snapshot } = await service.monthly(1);
      expect(snapshot.payingByPackage).toMatchObject({ GUARD: 1, COMPLETE: 1 });
      expect(snapshot.leadGenAddOns).toBe(1);
    });
    /**
     * The plan mix is counted from subscriptions, the account total from
     * tenants -- so both must apply the same verified-user filter. Without it
     * the dev database reported "47 plans" beside "17 accounts", and a
     * dashboard that disagrees with itself gets ignored.
     */
    it('counts the plan mix over verified tenants only', async () => {
      const { service, prisma } = build();
      await service.monthly(1);

      const call = (prisma.tenantSubscription.findMany as jest.Mock).mock
        .calls[0][0];
      expect(call.where).toEqual({
        tenant: { users: { some: { emailVerified: true } } },
      });
    });

    it('classifies paying, comped, trial and planless tenants', async () => {
      const { service, prisma } = build();
      (prisma.tenantSubscription.findMany as jest.Mock).mockResolvedValue([
        // Paying: Stripe, live, and carries the id only a real payment creates.
        {
          source: 'STRIPE',
          status: 'ACTIVE',
          aiEnabled: true,
          compExpiresAt: null,
          providerSubscriptionId: 'sub_1',
        },
        // A fresh self-signup also defaults to STRIPE but has no id, so it
        // has no plan -- counting it as paying is the trap here.
        {
          source: 'STRIPE',
          status: 'ACTIVE',
          aiEnabled: true,
          compExpiresAt: null,
          providerSubscriptionId: null,
        },
        {
          source: 'COMP',
          status: 'ACTIVE',
          aiEnabled: true,
          compExpiresAt: null,
          providerSubscriptionId: null,
        },
        {
          source: 'COMP',
          status: 'ACTIVE',
          aiEnabled: false,
          compExpiresAt: null,
          providerSubscriptionId: null,
        },
      ]);

      const { snapshot } = await service.monthly(1);
      expect(snapshot.planMix).toEqual({
        paying: 1,
        none: 1,
        comped: 1,
        trial: 1,
      });
    });

    it('reports a Decimal AI cost as a plain number', async () => {
      const { service, prisma } = build();
      (prisma.aiUsageEvent.aggregate as jest.Mock).mockResolvedValue({
        _sum: { totalTokens: 1234, estimatedCostUsd: '0.0375' },
        _count: { _all: 9 },
      });

      const { snapshot } = await service.monthly(1);
      expect(snapshot.aiCostUsdLifetime).toBe(0.0375);
      expect(snapshot.aiTokensLifetime).toBe(1234);
      expect(snapshot.aiCallsLifetime).toBe(9);
    });
  });

  it('states the window timezone, because the buckets are UTC months', async () => {
    const { service } = build();
    const result = await service.monthly(1);

    expect(result.timezone).toBe('UTC');
    expect(result.approximations.moduleActivations).toMatch(/first time/i);
    expect(result.approximations.creditRevenueUsd).toMatch(/list price/i);
  });

  // Anything that reaches the response must survive JSON. Postgres returns
  // COUNT and SUM(int) as bigint, which JSON.stringify throws on, so the SQL
  // casts them -- this is the regression guard for that.
  it('produces a response that serializes', async () => {
    const { service } = build({
      credits: [
        {
          bucket: monthKey(0),
          channel: 'pack',
          packSize: 3000,
          purchases: 1,
          credits: 3000,
        },
      ],
    });
    const result = await service.monthly(3);
    expect(() => JSON.stringify(result)).not.toThrow();
  });
});
