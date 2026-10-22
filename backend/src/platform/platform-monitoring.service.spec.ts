import { PlatformMonitoringService } from './platform-monitoring.service';

/**
 * The real logic here is plan classification: a Trial plan is a live comp with
 * AI off, a comped paid plan is a live comp with AI on, and a Stripe row is
 * paying. These tests pin that, and double as a check that the service wires up
 * over its two dependencies.
 */
function build(overrides: {
  subscriptions?: unknown[];
  tenants?: unknown[];
  topTenants?: unknown[];
  tenantCount?: number;
  creditSum?: number | null;
  aiCostSum?: number | null;
  aiCalls?: number;
}) {
  const prisma = {
    tenant: {
      count: jest.fn().mockResolvedValue(overrides.tenantCount ?? 0),
      findMany: jest.fn().mockResolvedValue(overrides.tenants ?? []),
    },
    tenantSubscription: {
      findMany: jest.fn().mockResolvedValue(overrides.subscriptions ?? []),
    },
    tenantCreditBalance: {
      aggregate: jest
        .fn()
        .mockResolvedValue({ _sum: { balance: overrides.creditSum ?? 0 } }),
    },
    aiUsageEvent: {
      aggregate: jest.fn().mockResolvedValue({
        _sum: { estimatedCostUsd: overrides.aiCostSum ?? 0 },
        _count: { _all: overrides.aiCalls ?? 0 },
      }),
    },
    creditAutoRechargeAttempt: { findMany: jest.fn().mockResolvedValue([]) },
  };

  const aiUsage = {
    getTopTenantsByCost: jest
      .fn()
      .mockResolvedValue(overrides.topTenants ?? []),
    getFeatureCostSummary: jest.fn().mockResolvedValue([]),
  };

  const service = new PlatformMonitoringService(
    prisma as never,
    aiUsage as never,
  );
  return { service, prisma, aiUsage };
}

const future = new Date(Date.now() + 30 * 86_400_000);
const past = new Date(Date.now() - 86_400_000);

describe('PlatformMonitoringService.overview', () => {
  it('counts paying, trial and comped-paid tenants separately', async () => {
    const { service } = build({
      tenantCount: 5,
      subscriptions: [
        {
          status: 'ACTIVE',
          source: 'STRIPE',
          aiEnabled: true,
          compExpiresAt: null,
        },
        // Trial: live comp, AI off.
        {
          status: 'ACTIVE',
          source: 'COMP',
          aiEnabled: false,
          compExpiresAt: future,
        },
        // Comped paid: live comp, AI on.
        {
          status: 'ACTIVE',
          source: 'COMP',
          aiEnabled: true,
          compExpiresAt: future,
        },
        // Lapsed comp counts as neither.
        {
          status: 'ACTIVE',
          source: 'COMP',
          aiEnabled: false,
          compExpiresAt: past,
        },
        // Cancelled Stripe is not paying.
        {
          status: 'CANCELED',
          source: 'STRIPE',
          aiEnabled: true,
          compExpiresAt: null,
        },
      ],
    });

    const result = await service.overview();

    expect(result.tenants).toBe(5);
    expect(result.subscriptions).toEqual({
      paying: 1,
      trial: 1,
      compedPaid: 1,
    });
  });
});

describe('PlatformMonitoringService.tenants', () => {
  const tenantRow = (id: string, sub: Record<string, unknown> | null) => ({
    id,
    name: `Tenant ${id}`,
    createdAt: new Date(),
    slug: id,
    isActive: true,
    suspendedAt: null,
    suspendedReason: null,
    _count: { users: 3 },
    subscription: sub,
    creditBalance: { balance: 42, lifetimeConsumed: 10 },
  });

  it('labels each tenant with the right plan and folds in AI cost', async () => {
    const { service } = build({
      tenants: [
        tenantRow('t-pay', {
          status: 'ACTIVE',
          source: 'STRIPE',
          aiEnabled: true,
          compExpiresAt: null,
          compReason: null,
        }),
        tenantRow('t-trial', {
          status: 'ACTIVE',
          source: 'COMP',
          aiEnabled: false,
          compExpiresAt: future,
          compReason: 'pilot',
        }),
        tenantRow('t-comp', {
          status: 'ACTIVE',
          source: 'COMP',
          aiEnabled: true,
          compExpiresAt: future,
          compReason: 'VIP',
        }),
        tenantRow('t-none', null),
      ],
      topTenants: [{ tenantId: 't-trial', costUsd: 3.5, calls: 7 }],
    });

    const rows = await service.tenants();
    const byId = Object.fromEntries(rows.map((r) => [r.tenantId, r]));

    expect(byId['t-pay'].plan).toBe('STRIPE');
    expect(byId['t-trial'].plan).toBe('TRIAL');
    expect(byId['t-trial'].aiCostUsd30d).toBe(3.5);
    expect(byId['t-comp'].plan).toBe('COMP');
    expect(byId['t-none'].plan).toBe('NONE');
    expect(byId['t-pay'].creditBalance).toBe(42);
    // The console needs these to render suspend/delete, so they are part of
    // the contract rather than incidental extra fields.
    expect(byId['t-pay'].isActive).toBe(true);
    expect(byId['t-pay'].userCount).toBe(3);
    expect(byId['t-pay'].slug).toBe('t-pay');
  });
});
