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
  const tenantRow = (
    id: string,
    sub: Record<string, unknown> | null,
    modules: string[] = [],
  ) => ({
    id,
    name: `Tenant ${id}`,
    createdAt: new Date(),
    slug: id,
    isActive: true,
    suspendedAt: null,
    suspendedReason: null,
    ownerUserId: `${id}-owner`,
    _count: { users: 3 },
    users: [
      { id: `${id}-owner`, email: `${id}@example.com`, emailVerified: true },
    ],
    subscription: sub,
    modules: modules.map((module) => ({ module })),
    creditBalance: { balance: 42, lifetimeConsumed: 10 },
  });

  const ALL_MODULES = ['LEAD_GEN', 'GUARD_TOUR', 'FINANCE'];

  it('labels each tenant with the right plan and folds in AI cost', async () => {
    const { service } = build({
      tenants: [
        tenantRow(
          't-pay',
          {
            status: 'ACTIVE',
            source: 'STRIPE',
            aiEnabled: true,
            compExpiresAt: null,
            compPlan: null,
            compReason: null,
          },
          ALL_MODULES,
        ),
        // The case the plan name exists for: Trial unlocks all three modules,
        // exactly like Complete, so naming it from the modules called it
        // "AegisLead Complete".
        tenantRow(
          't-trial',
          {
            status: 'ACTIVE',
            source: 'COMP',
            aiEnabled: false,
            compExpiresAt: future,
            compPlan: 'TRIAL',
            compReason: 'pilot',
          },
          ALL_MODULES,
        ),
        tenantRow(
          't-comp',
          {
            status: 'ACTIVE',
            source: 'COMP',
            aiEnabled: true,
            compExpiresAt: future,
            compPlan: 'OPERATIONS',
            compReason: 'VIP',
          },
          ['FINANCE'],
        ),
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

    // WHICH plan, which is what the screen shows. A Trial tenant holds all
    // three modules, so this must come from the recorded grant and not from
    // the modules -- otherwise it reads "AegisLead Complete".
    expect(byId['t-trial'].planName).toBe('AegisLead Trial Plan');
    expect(byId['t-comp'].planName).toBe('AegisLead Operations');
    expect(byId['t-pay'].planName).toBe('AegisLead Complete');
    expect(byId['t-none'].planName).toBeNull();
    expect(byId['t-pay'].creditBalance).toBe(42);
    // The console needs these to render suspend/delete, so they are part of
    // the contract rather than incidental extra fields.
    expect(byId['t-pay'].isActive).toBe(true);
    expect(byId['t-pay'].userCount).toBe(3);
    expect(byId['t-pay'].slug).toBe('t-pay');
    // The account email now shows in the Tenants table, read from the owner.
    expect(byId['t-pay'].email).toBe('t-pay@example.com');
  });
});
