import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { EntitlementsService } from './entitlements.service';

describe('EntitlementsService', () => {
  let service: EntitlementsService;
  let prisma: {
    tenantSubscription: { findUnique: jest.Mock };
    tenantModule: { findMany: jest.Mock };
  };

  const withTenant = async (
    status: string | null,
    modules: string[],
  ) => {
    prisma.tenantSubscription.findUnique.mockResolvedValue(
      status === null ? null : { status },
    );
    prisma.tenantModule.findMany.mockResolvedValue(
      modules.map((module) => ({ module })),
    );
    return service.modulesForTenant(`tenant-${Math.random()}`);
  };

  beforeEach(async () => {
    prisma = {
      tenantSubscription: { findUnique: jest.fn() },
      tenantModule: { findMany: jest.fn() },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        EntitlementsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = moduleRef.get(EntitlementsService);
  });

  it('grants only the modules the tenant purchased', async () => {
    const modules = await withTenant('ACTIVE', ['LEAD_GEN']);

    expect([...modules]).toEqual(['LEAD_GEN']);
  });

  it('keeps access while TRIALING', async () => {
    expect([...(await withTenant('TRIALING', ['LEAD_GEN']))]).toEqual([
      'LEAD_GEN',
    ]);
  });

  // Dunning is a billing conversation, not a reason to strand a paying
  // customer mid-shift.
  it('keeps access while PAST_DUE', async () => {
    expect([...(await withTenant('PAST_DUE', ['GUARD_TOUR']))]).toEqual([
      'GUARD_TOUR',
    ]);
  });

  it('revokes every module once CANCELED', async () => {
    expect([...(await withTenant('CANCELED', ['LEAD_GEN']))]).toEqual([]);
  });

  // Signup creates a subscription row in the same transaction as the tenant,
  // so a missing row is corruption rather than a legitimate state. This used
  // to fail open and grant all three services, which handed every new signup
  // the full product for free.
  it('fails closed when the tenant has no subscription row', async () => {
    const modules = await withTenant(null, []);

    expect([...modules]).toEqual([]);
  });

  it('ignores deactivated modules', async () => {
    prisma.tenantSubscription.findUnique.mockResolvedValue({
      status: 'ACTIVE',
    });
    prisma.tenantModule.findMany.mockResolvedValue([{ module: 'LEAD_GEN' }]);

    await service.modulesForTenant('tenant-active-filter');

    expect(prisma.tenantModule.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isActive: true }),
      }),
    );
  });

  describe('hasAnyModule', () => {
    beforeEach(() => {
      prisma.tenantSubscription.findUnique.mockResolvedValue({
        status: 'ACTIVE',
      });
      prisma.tenantModule.findMany.mockResolvedValue([{ module: 'LEAD_GEN' }]);
    });

    it('allows a purchased module', async () => {
      await expect(service.hasAnyModule('t1', ['LEAD_GEN'])).resolves.toBe(
        true,
      );
    });

    it('denies an unpurchased module', async () => {
      await expect(service.hasAnyModule('t2', ['FINANCE'])).resolves.toBe(
        false,
      );
    });

    it('allows when any one of several is purchased', async () => {
      await expect(
        service.hasAnyModule('t3', ['FINANCE', 'LEAD_GEN']),
      ).resolves.toBe(true);
    });

    it('allows when nothing is required', async () => {
      await expect(service.hasAnyModule('t4', [])).resolves.toBe(true);
    });
  });

  it('caches per tenant and re-reads after invalidate', async () => {
    prisma.tenantSubscription.findUnique.mockResolvedValue({
      status: 'ACTIVE',
    });
    prisma.tenantModule.findMany.mockResolvedValue([{ module: 'LEAD_GEN' }]);

    await service.modulesForTenant('tenant-cache');
    await service.modulesForTenant('tenant-cache');
    expect(prisma.tenantModule.findMany).toHaveBeenCalledTimes(1);

    service.invalidate('tenant-cache');
    await service.modulesForTenant('tenant-cache');
    expect(prisma.tenantModule.findMany).toHaveBeenCalledTimes(2);
  });

  it('grants nothing to a request with no tenant', async () => {
    expect([...(await service.modulesForTenant(''))]).toEqual([]);
  });

  describe('complimentary access', () => {
    const withComp = async (compExpiresAt: Date | null, status = 'ACTIVE') => {
      prisma.tenantSubscription.findUnique.mockResolvedValue({
        status,
        source: 'COMP',
        compExpiresAt,
      });
      prisma.tenantModule.findMany.mockResolvedValue([
        { module: 'LEAD_GEN' },
        { module: 'GUARD_TOUR' },
        { module: 'FINANCE' },
      ]);
      return service.modulesForTenant(`tenant-${Math.random()}`);
    };

    it('grants the comped modules while the comp is live', async () => {
      expect([...(await withComp(null))].sort()).toEqual([
        'FINANCE',
        'GUARD_TOUR',
        'LEAD_GEN',
      ]);
    });

    it('still grants them before the end date', async () => {
      const future = new Date(Date.now() + 86_400_000);

      expect([...(await withComp(future))].length).toBe(3);
    });

    /**
     * The point of checking expiry on read. The status still says ACTIVE --
     * no job has been round to change it -- and the module rows are still
     * flagged active. Only the date says otherwise, and that has to be
     * enough, or a job that silently stopped running means indefinite free
     * access that nobody notices.
     */
    it('grants nothing once a lapsed comp is read, even with status ACTIVE', async () => {
      const past = new Date(Date.now() - 86_400_000);

      expect([...(await withComp(past))]).toEqual([]);
    });

    it('grants nothing after the comp is revoked', async () => {
      expect([...(await withComp(null, 'CANCELED'))]).toEqual([]);
    });

    // A comp must never imply credits: the tenant buys those themselves.
    // Entitlements has no business reading the ledger, and this pins that.
    it('never touches the credit ledger', async () => {
      await withComp(null);

      expect(prisma).not.toHaveProperty('creditLedgerEntry');
    });
  });

  describe('isAiEnabled', () => {
    const withAi = async (
      row: {
        status?: string;
        source?: string;
        compExpiresAt?: Date | null;
        aiEnabled?: boolean;
      } | null,
    ) => {
      prisma.tenantSubscription.findUnique.mockResolvedValue(row);
      return service.isAiEnabled(`tenant-${Math.random()}`);
    };

    it('is true for an active tenant with AI on', async () => {
      await expect(
        withAi({ status: 'ACTIVE', source: 'STRIPE', aiEnabled: true }),
      ).resolves.toBe(true);
    });

    // The Trial plan: active and entitled, but AI withheld.
    it('is false when the flag is off', async () => {
      await expect(
        withAi({ status: 'ACTIVE', source: 'COMP', aiEnabled: false }),
      ).resolves.toBe(false);
    });

    it('is false when there is no subscription row', async () => {
      await expect(withAi(null)).resolves.toBe(false);
    });

    it('is false once CANCELED, whatever the flag says', async () => {
      await expect(
        withAi({ status: 'CANCELED', source: 'STRIPE', aiEnabled: true }),
      ).resolves.toBe(false);
    });

    // A lapsed comp grants nothing, AI included, even with the flag on.
    it('is false when a comp has lapsed, even with AI on', async () => {
      await expect(
        withAi({
          status: 'ACTIVE',
          source: 'COMP',
          aiEnabled: true,
          compExpiresAt: new Date(Date.now() - 86_400_000),
        }),
      ).resolves.toBe(false);
    });

    it('grants no AI to a request with no tenant', async () => {
      await expect(service.isAiEnabled('')).resolves.toBe(false);
    });

    it('caches per tenant and re-reads after invalidate', async () => {
      prisma.tenantSubscription.findUnique.mockResolvedValue({
        status: 'ACTIVE',
        source: 'STRIPE',
        aiEnabled: true,
      });

      await service.isAiEnabled('tenant-ai-cache');
      await service.isAiEnabled('tenant-ai-cache');
      expect(prisma.tenantSubscription.findUnique).toHaveBeenCalledTimes(1);

      service.invalidate('tenant-ai-cache');
      await service.isAiEnabled('tenant-ai-cache');
      expect(prisma.tenantSubscription.findUnique).toHaveBeenCalledTimes(2);
    });
  });

  describe('summaryForTenant', () => {
    it('reports a live comp so the plan page can suppress the price', async () => {
      const expiresAt = new Date(Date.now() + 86_400_000);
      prisma.tenantSubscription.findUnique.mockResolvedValue({
        status: 'ACTIVE',
        source: 'COMP',
        compExpiresAt: expiresAt,
        compReason: 'Early customer',
      });
      prisma.tenantModule.findMany.mockResolvedValue([{ module: 'LEAD_GEN' }]);

      const summary = await service.summaryForTenant('tenant-comped');

      expect(summary.comped).toBe(true);
      expect(summary.compExpiresAt).toEqual(expiresAt);
      expect(summary.compReason).toBe('Early customer');
    });

    it('reports no comp for a Stripe-backed tenant', async () => {
      prisma.tenantSubscription.findUnique.mockResolvedValue({
        status: 'ACTIVE',
        source: 'STRIPE',
        compExpiresAt: null,
        compReason: null,
      });
      prisma.tenantModule.findMany.mockResolvedValue([{ module: 'LEAD_GEN' }]);

      const summary = await service.summaryForTenant('tenant-paying');

      expect(summary.comped).toBe(false);
      expect(summary.compExpiresAt).toBeNull();
    });

    /** A lapsed comp must not still advertise itself as free access. */
    it('reports no comp once it has lapsed', async () => {
      prisma.tenantSubscription.findUnique.mockResolvedValue({
        status: 'ACTIVE',
        source: 'COMP',
        compExpiresAt: new Date(Date.now() - 86_400_000),
        compReason: 'Early customer',
      });
      prisma.tenantModule.findMany.mockResolvedValue([]);

      const summary = await service.summaryForTenant('tenant-lapsed');

      expect(summary.comped).toBe(false);
      expect(summary.compReason).toBeNull();
    });
  });

  /**
   * The plan page names the plan from this. It used to work the name out from
   * the active modules, which cannot tell the Trial plan from the Complete
   * package -- both unlock all three services -- so every tenant comped onto
   * Trial was shown "AegisLead Complete" as the plan they were on.
   */
  describe('summaryForTenant plan name', () => {
    const ALL_MODULES = [
      { module: 'LEAD_GEN' },
      { module: 'GUARD_TOUR' },
      { module: 'FINANCE' },
    ];

    it('names a comped Trial tenant Trial, not Complete', async () => {
      prisma.tenantSubscription.findUnique.mockResolvedValue({
        status: 'ACTIVE',
        source: 'COMP',
        aiEnabled: false,
        compExpiresAt: null,
        compPlan: 'TRIAL',
        compReason: 'pilot',
      });
      prisma.tenantModule.findMany.mockResolvedValue(ALL_MODULES);

      const summary = await service.summaryForTenant('tenant-trial');

      expect(summary.plan).toEqual({
        key: 'TRIAL',
        name: 'AegisLead Trial Plan',
      });
    });

    it('names a tenant comped onto Complete as Complete', async () => {
      prisma.tenantSubscription.findUnique.mockResolvedValue({
        status: 'ACTIVE',
        source: 'COMP',
        aiEnabled: true,
        compExpiresAt: null,
        compPlan: 'COMPLETE',
        compReason: 'VIP',
      });
      prisma.tenantModule.findMany.mockResolvedValue(ALL_MODULES);

      const summary = await service.summaryForTenant('tenant-comp-complete');

      expect(summary.plan).toEqual({
        key: 'COMPLETE',
        name: 'AegisLead Complete',
      });
    });

    /** A paying tenant records no plan, so the modules are all there is. */
    it('names a paying tenant from their modules', async () => {
      prisma.tenantSubscription.findUnique.mockResolvedValue({
        status: 'ACTIVE',
        source: 'STRIPE',
        aiEnabled: true,
        compExpiresAt: null,
        compPlan: null,
        compReason: null,
      });
      prisma.tenantModule.findMany.mockResolvedValue([{ module: 'FINANCE' }]);

      const summary = await service.summaryForTenant('tenant-paying');

      expect(summary.plan).toEqual({
        key: 'OPERATIONS',
        name: 'AegisLead Operations',
      });
    });

    /**
     * Once a Trial comp lapses the tenant is not on Trial any more, so the
     * name must stop coming from the grant. They hold nothing, so there is no
     * name at all.
     */
    it('stops naming a lapsed Trial comp', async () => {
      prisma.tenantSubscription.findUnique.mockResolvedValue({
        status: 'ACTIVE',
        source: 'COMP',
        aiEnabled: false,
        compExpiresAt: new Date(Date.now() - 86_400_000),
        compPlan: 'TRIAL',
        compReason: 'pilot',
      });
      prisma.tenantModule.findMany.mockResolvedValue([]);

      const summary = await service.summaryForTenant('tenant-lapsed-trial');

      expect(summary.plan).toBeNull();
    });
  });
});
