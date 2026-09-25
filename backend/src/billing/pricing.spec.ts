import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { GuardMeteringService } from './guard-metering.service';
import {
  MONTHLY_PRICES,
  bandForGuardCount,
  billableBand,
  isCustomQuote,
  packageForModules,
} from './pricing.constants';

describe('pricing', () => {
  describe('guard bands', () => {
    it.each([
      [1, '1-25'],
      [25, '1-25'],
      [26, '26-50'],
      [50, '26-50'],
      [51, '51-100'],
      [100, '51-100'],
      [101, '101-250'],
      [250, '101-250'],
      [251, '251-500'],
      [500, '251-500'],
      [501, '500+'],
      [5000, '500+'],
    ])('puts %i guards in band %s', (count, expected) => {
      expect(bandForGuardCount(count)).toBe(expected);
    });

    // A tenant with no guards yet must still land somewhere sensible.
    it('puts zero guards in the base band', () => {
      expect(bandForGuardCount(0)).toBe('1-25');
    });

    it('treats the top band as a sales quote, not a self-serve price', () => {
      expect(isCustomQuote('500+')).toBe(true);
      expect(isCustomQuote('251-500')).toBe(false);
      expect(MONTHLY_PRICES.COMPLETE['500+']).toBeNull();
    });
  });

  describe('package resolution', () => {
    it.each([
      [['LEAD_GEN'], 'GENERATION'],
      [['GUARD_TOUR'], 'GUARD'],
      [['FINANCE'], 'OPERATIONS'],
      [['LEAD_GEN', 'GUARD_TOUR', 'FINANCE'], 'COMPLETE'],
    ])('maps %s to %s', (modules, expected) => {
      expect(packageForModules(modules as never)).toBe(expected);
    });

    it('does not care about module order', () => {
      expect(packageForModules(['FINANCE', 'LEAD_GEN', 'GUARD_TOUR'])).toBe(
        'COMPLETE',
      );
    });

    // Two of three is not one of the four published packages.
    it('returns null for a combination outside the price table', () => {
      expect(packageForModules(['LEAD_GEN', 'GUARD_TOUR'])).toBeNull();
      expect(packageForModules([])).toBeNull();
    });
  });

  describe('Generation-only pricing', () => {
    // Confirmed with the client: a Generation-only customer pays $299/mo flat.
    // Generation is a sales tool, and such a customer may not track guards in
    // the system at all.
    it.each([0, 10, 200, 900])(
      'stays on the base band with %i guards',
      (guards) => {
        expect(billableBand('GENERATION', guards)).toBe('1-25');
        expect(MONTHLY_PRICES.GENERATION[billableBand('GENERATION', guards)]).toBe(
          299,
        );
      },
    );

    it('still bands the other packages by guard count', () => {
      expect(billableBand('GUARD', 200)).toBe('101-250');
      expect(billableBand('OPERATIONS', 60)).toBe('51-100');
      expect(billableBand('COMPLETE', 300)).toBe('251-500');
    });
  });

  describe('the published table', () => {
    it('matches the prices supplied by the client', () => {
      expect(MONTHLY_PRICES.GENERATION['1-25']).toBe(299);
      expect(MONTHLY_PRICES.GUARD['1-25']).toBe(99);
      expect(MONTHLY_PRICES.OPERATIONS['1-25']).toBe(199);
      expect(MONTHLY_PRICES.COMPLETE['1-25']).toBe(499);

      expect(MONTHLY_PRICES.COMPLETE['251-500']).toBe(1699);
      expect(MONTHLY_PRICES.GUARD['251-500']).toBe(599);
    });

    // Complete has to be worth buying, or the packaging makes no sense.
    it('prices Complete below the sum of its parts in every band', () => {
      for (const band of [
        '1-25',
        '26-50',
        '51-100',
        '101-250',
        '251-500',
      ] as const) {
        const parts =
          (MONTHLY_PRICES.GENERATION[band] ?? 0) +
          (MONTHLY_PRICES.GUARD[band] ?? 0) +
          (MONTHLY_PRICES.OPERATIONS[band] ?? 0);

        expect(MONTHLY_PRICES.COMPLETE[band]!).toBeLessThan(parts);
      }
    });

    it('never decreases as the guard count grows', () => {
      for (const pkg of ['GUARD', 'OPERATIONS', 'COMPLETE'] as const) {
        const ladder = [
          '1-25',
          '26-50',
          '51-100',
          '101-250',
          '251-500',
        ] as const;

        for (let i = 1; i < ladder.length; i += 1) {
          expect(MONTHLY_PRICES[pkg][ladder[i]]!).toBeGreaterThan(
            MONTHLY_PRICES[pkg][ladder[i - 1]]!,
          );
        }
      }
    });
  });
});

describe('GuardMeteringService', () => {
  let service: GuardMeteringService;
  let prisma: { guard: { count: jest.Mock } };
  let entitlements: { modulesForTenant: jest.Mock };

  beforeEach(async () => {
    prisma = { guard: { count: jest.fn().mockResolvedValue(0) } };
    entitlements = {
      modulesForTenant: jest.fn().mockResolvedValue(new Set(['GUARD_TOUR'])),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        GuardMeteringService,
        { provide: PrismaService, useValue: prisma },
        { provide: EntitlementsService, useValue: entitlements },
      ],
    }).compile();

    service = moduleRef.get(GuardMeteringService);
  });

  // Counting every guard row ever created would bill customers for leavers.
  it('counts only guards rostered in the last 30 days', async () => {
    await service.activeGuardCount('tenant-1');

    const where = prisma.guard.count.mock.calls[0][0].where as {
      assignments: { some: { shift: { startTime: { gte: Date } } } };
    };
    const since = where.assignments.some.shift.startTime.gte;
    const daysAgo = (Date.now() - since.getTime()) / (24 * 60 * 60 * 1000);

    expect(Math.round(daysAgo)).toBe(30);
  });

  it('bands a Guard tenant by its active guard count', async () => {
    prisma.guard.count.mockResolvedValue(60);

    const profile = await service.billingProfile('tenant-1');

    expect(profile).toEqual(
      expect.objectContaining({
        packageKey: 'GUARD',
        band: '51-100',
        monthlyPrice: 249,
        customQuote: false,
      }),
    );
  });

  it('keeps a Generation-only tenant on the base price whatever its headcount', async () => {
    entitlements.modulesForTenant.mockResolvedValue(new Set(['LEAD_GEN']));
    prisma.guard.count.mockResolvedValue(300);

    const profile = await service.billingProfile('tenant-1');

    expect(profile).toEqual(
      expect.objectContaining({
        packageKey: 'GENERATION',
        band: '1-25',
        monthlyPrice: 299,
      }),
    );
  });

  it('flags the top band as needing a quote', async () => {
    entitlements.modulesForTenant.mockResolvedValue(
      new Set(['LEAD_GEN', 'GUARD_TOUR', 'FINANCE']),
    );
    prisma.guard.count.mockResolvedValue(900);

    const profile = await service.billingProfile('tenant-1');

    expect(profile).toEqual(
      expect.objectContaining({
        packageKey: 'COMPLETE',
        band: '500+',
        monthlyPrice: null,
        customQuote: true,
      }),
    );
  });

  it('treats a combination outside the four packages as custom', async () => {
    entitlements.modulesForTenant.mockResolvedValue(
      new Set(['LEAD_GEN', 'GUARD_TOUR']),
    );

    const profile = await service.billingProfile('tenant-1');

    expect(profile).toEqual(
      expect.objectContaining({ packageKey: null, customQuote: true }),
    );
  });

  describe('band drift', () => {
    // Read-only on purpose: moving a customer up a band changes what they pay,
    // and that should be a deliberate act, not a side effect of a rota edit.
    it('reports when a tenant has outgrown its band', async () => {
      prisma.guard.count.mockResolvedValue(120);

      await expect(service.bandDrift('tenant-1', '26-50')).resolves.toEqual(
        expect.objectContaining({
          drifted: true,
          from: '26-50',
          to: '101-250',
        }),
      );
    });

    it('reports no drift when the band still fits', async () => {
      prisma.guard.count.mockResolvedValue(30);

      await expect(service.bandDrift('tenant-1', '26-50')).resolves.toEqual(
        expect.objectContaining({ drifted: false }),
      );
    });
  });
});
