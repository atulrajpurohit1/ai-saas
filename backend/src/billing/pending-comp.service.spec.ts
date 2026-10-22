import { PendingCompService } from './pending-comp.service';
import { TRIAL_PLAN_KEY } from './comp-plan.constants';

/**
 * Granting the free (Trial) plan used to take effect the instant the owner
 * clicked it, whatever the tenant was already on. For a paying customer that
 * is a downgrade nobody asked for: AI switches off, `source` flips to COMP so
 * the Stripe webhook stops writing to them, and Stripe carries on billing for
 * a period they can no longer use in full.
 *
 * These tests pin the queue that fixes it: the grant waits for the paid plan
 * to end, and the only two things that release it are the Stripe cancellation
 * event and the date sweep.
 */
describe('PendingCompService', () => {
  const NOW = new Date('2026-10-23T00:00:00.000Z');
  const PERIOD_END = new Date('2026-11-15T00:00:00.000Z');

  let service: PendingCompService;
  let prisma: {
    tenantSubscription: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
    };
  };
  let provisioning: { provision: jest.Mock };
  let audit: { log: jest.Mock };

  const subscriptionRow = (overrides: Record<string, unknown> = {}) => ({
    source: 'STRIPE',
    status: 'ACTIVE',
    currentPeriodEnd: PERIOD_END,
    providerSubscriptionId: 'sub_123',
    pendingCompPlan: null,
    pendingCompStartsAt: null,
    pendingCompDays: null,
    pendingCompReason: null,
    pendingCompGrantedBy: null,
    ...overrides,
  });

  const CLEARED = {
    pendingCompPlan: null,
    pendingCompStartsAt: null,
    pendingCompDays: null,
    pendingCompReason: null,
    pendingCompGrantedBy: null,
  };

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(NOW);

    prisma = {
      tenantSubscription: {
        findUnique: jest.fn().mockResolvedValue(subscriptionRow()),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    provisioning = { provision: jest.fn().mockResolvedValue({ modules: [] }) };
    audit = { log: jest.fn().mockResolvedValue(undefined) };

    service = new PendingCompService(
      prisma as never,
      provisioning as never,
      audit as never,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('livePaidPlan', () => {
    it('reports the period end of a live paid subscription', async () => {
      await expect(service.livePaidPlan('tenant-1')).resolves.toEqual({
        endsAt: PERIOD_END,
      });
    });

    it('reports nothing for a tenant already on a comp', async () => {
      prisma.tenantSubscription.findUnique.mockResolvedValue(
        subscriptionRow({ source: 'COMP' }),
      );

      // Swapping one comp for another has no payment to see out, so it should
      // apply immediately rather than queue behind nothing.
      await expect(service.livePaidPlan('tenant-1')).resolves.toBeNull();
    });

    it('reports nothing for a cancelled subscription', async () => {
      prisma.tenantSubscription.findUnique.mockResolvedValue(
        subscriptionRow({ status: 'CANCELED' }),
      );

      await expect(service.livePaidPlan('tenant-1')).resolves.toBeNull();
    });

    it('reports nothing with no Stripe subscription behind the row', async () => {
      prisma.tenantSubscription.findUnique.mockResolvedValue(
        subscriptionRow({ providerSubscriptionId: null }),
      );

      // Provisioned by hand: nobody is being charged, so nothing to protect.
      await expect(service.livePaidPlan('tenant-1')).resolves.toBeNull();
    });

    it('reports nothing when the recorded period has already elapsed', async () => {
      prisma.tenantSubscription.findUnique.mockResolvedValue(
        subscriptionRow({
          currentPeriodEnd: new Date('2026-09-01T00:00:00.000Z'),
        }),
      );

      await expect(service.livePaidPlan('tenant-1')).resolves.toBeNull();
    });

    it('queues a live subscription whose period end was never recorded', async () => {
      prisma.tenantSubscription.findUnique.mockResolvedValue(
        subscriptionRow({ currentPeriodEnd: null }),
      );

      // Queued with no date: the Stripe cancellation event releases it.
      await expect(service.livePaidPlan('tenant-1')).resolves.toEqual({
        endsAt: null,
      });
    });

    it('reports nothing for a tenant with no subscription row at all', async () => {
      prisma.tenantSubscription.findUnique.mockResolvedValue(null);

      await expect(service.livePaidPlan('tenant-1')).resolves.toBeNull();
    });
  });

  describe('schedule', () => {
    it('parks the grant without touching entitlements', async () => {
      await service.schedule({
        tenantId: 'tenant-1',
        plan: TRIAL_PLAN_KEY,
        startsAt: PERIOD_END,
        days: 30,
        reason: 'Pilot customer',
        grantedBy: 'admin-1',
      });

      expect(prisma.tenantSubscription.update).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-1' },
        data: {
          pendingCompPlan: 'TRIAL',
          pendingCompStartsAt: PERIOD_END,
          pendingCompDays: 30,
          pendingCompReason: 'Pilot customer',
          pendingCompGrantedBy: 'admin-1',
        },
      });

      // The whole point: the paying customer is left exactly as they were.
      expect(provisioning.provision).not.toHaveBeenCalled();
    });
  });

  describe('activate', () => {
    const withPending = (overrides: Record<string, unknown> = {}) => {
      prisma.tenantSubscription.findUnique.mockResolvedValue(
        subscriptionRow({
          pendingCompPlan: 'TRIAL',
          pendingCompStartsAt: PERIOD_END,
          pendingCompDays: 30,
          pendingCompReason: 'Pilot customer',
          pendingCompGrantedBy: 'admin-1',
          ...overrides,
        }),
      );
    };

    it('provisions the queued plan with AI off and clears the queue', async () => {
      withPending();

      const result = await service.activate('tenant-1', 'sweep');

      expect(provisioning.provision).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-1',
          status: 'ACTIVE',
          source: 'COMP',
          aiEnabled: false,
          compReason: 'Pilot customer',
          compGrantedBy: 'admin-1',
          reason: 'comp-activated:sweep',
        }),
      );
      expect(result?.plan).toBe('TRIAL');

      expect(prisma.tenantSubscription.update).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-1' },
        data: CLEARED,
      });
    });

    it('counts the comp term from activation, not from the grant', async () => {
      withPending();

      const result = await service.activate('tenant-1', 'sweep');

      // 30 days from NOW, not from the grant weeks earlier: a 30-day free plan
      // queued behind paid service is still 30 days of free service.
      expect(result?.expiresAt).toEqual(new Date('2026-11-22T00:00:00.000Z'));
    });

    it('leaves an open-ended grant with no expiry', async () => {
      withPending({ pendingCompDays: null });

      const result = await service.activate('tenant-1', 'sweep');

      expect(result?.expiresAt).toBeNull();
      expect(provisioning.provision).toHaveBeenCalledWith(
        expect.objectContaining({ compExpiresAt: null }),
      );
    });

    it('does nothing for a tenant with no queued grant', async () => {
      await expect(service.activate('tenant-1', 'sweep')).resolves.toBeNull();
      expect(provisioning.provision).not.toHaveBeenCalled();
    });

    it('refuses a queued plan key the product no longer knows', async () => {
      withPending({ pendingCompPlan: 'LEGACY_FREEBIE' });

      // Provisioning it would resolve to an empty module list and lock the
      // tenant out of everything.
      await expect(service.activate('tenant-1', 'sweep')).resolves.toBeNull();
      expect(provisioning.provision).not.toHaveBeenCalled();
    });

    it('keeps the queue intact when provisioning fails', async () => {
      withPending();
      provisioning.provision.mockRejectedValue(new Error('db down'));

      await expect(service.activate('tenant-1', 'sweep')).rejects.toThrow(
        'db down',
      );

      // Nothing cleared, so the sweep retries it rather than losing the grant.
      expect(prisma.tenantSubscription.update).not.toHaveBeenCalled();
    });
  });

  describe('activateDue', () => {
    it('only looks for grants whose start date has passed', async () => {
      await service.activateDue();

      expect(prisma.tenantSubscription.findMany).toHaveBeenCalledWith({
        where: {
          pendingCompPlan: { not: null },
          pendingCompStartsAt: { not: null, lte: NOW },
        },
        select: { tenantId: true },
      });
    });

    it('carries on after a tenant that fails', async () => {
      prisma.tenantSubscription.findMany.mockResolvedValue([
        { tenantId: 'tenant-1' },
        { tenantId: 'tenant-2' },
      ]);
      prisma.tenantSubscription.findUnique.mockResolvedValue(
        subscriptionRow({
          pendingCompPlan: 'TRIAL',
          pendingCompStartsAt: PERIOD_END,
          pendingCompReason: 'Pilot',
          pendingCompGrantedBy: 'admin-1',
        }),
      );
      provisioning.provision
        .mockRejectedValueOnce(new Error('db down'))
        .mockResolvedValueOnce({ modules: [] });

      await expect(service.activateDue()).resolves.toEqual({
        due: 2,
        activated: 1,
        failures: 1,
      });
    });
  });

  describe('cancel', () => {
    it('clears a queued grant', async () => {
      prisma.tenantSubscription.findUnique.mockResolvedValue(
        subscriptionRow({ pendingCompPlan: 'TRIAL' }),
      );

      await expect(service.cancel('tenant-1')).resolves.toBe(true);
      expect(prisma.tenantSubscription.update).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-1' },
        data: CLEARED,
      });
    });

    it('reports nothing to cancel when no grant is queued', async () => {
      await expect(service.cancel('tenant-1')).resolves.toBe(false);
      expect(prisma.tenantSubscription.update).not.toHaveBeenCalled();
    });
  });
});
