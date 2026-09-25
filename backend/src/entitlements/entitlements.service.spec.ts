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

  // A tenant predating this system that missed the backfill must not be
  // locked out of a product it already pays for.
  it('fails open when the tenant has no subscription row', async () => {
    const modules = await withTenant(null, []);

    expect([...modules].sort()).toEqual(['FINANCE', 'GUARD_TOUR', 'LEAD_GEN']);
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
});
