import { BandDriftService } from './band-drift.service';
import { planLookupKey } from './pricing.constants';

/**
 * Guard bands are priced by headcount, and checkout enforces that at purchase
 * time. Nothing re-checked afterwards -- GuardMeteringService.bandDrift was
 * written for exactly this and had no callers -- so an account could buy Guard
 * at 1-25, grow to 400 guards and keep paying the 1-25 price forever with
 * nobody told. These tests pin the sweep that reports it.
 */
describe('BandDriftService', () => {
  const ORIGINAL_ENV = process.env;

  let service: BandDriftService;
  let prisma: { tenantSubscription: { findMany: jest.Mock } };
  let metering: { bandDrift: jest.Mock };
  let stripe: { currentPlanLookupKey: jest.Mock };
  let email: { sendBandDriftDigestEmail: jest.Mock };
  let config: { get: jest.Mock };

  const build = (driftEmail?: string) => {
    prisma = {
      tenantSubscription: { findMany: jest.fn().mockResolvedValue([]) },
    };
    metering = { bandDrift: jest.fn() };
    stripe = { currentPlanLookupKey: jest.fn() };
    email = { sendBandDriftDigestEmail: jest.fn().mockResolvedValue({}) };
    config = {
      get: jest.fn((key: string) =>
        key === 'BILLING_DRIFT_ALERT_EMAIL' ? driftEmail : undefined,
      ),
    };

    service = new BandDriftService(
      prisma as never,
      metering as never,
      stripe as never,
      email as never,
      config as never,
    );
  };

  const withTenant = (name = 'Acme Security') => {
    prisma.tenantSubscription.findMany.mockResolvedValue([
      { tenantId: 'tenant-1', tenant: { name } },
    ]);
  };

  beforeEach(() => {
    // isCheckoutConfigured() reads the Stripe key straight off the env.
    process.env = { ...ORIGINAL_ENV, STRIPE_SECRET_KEY: 'sk_test_123' };
    build('billing@example.com');
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('reports a tenant that has outgrown its band, and prices the gap', async () => {
    withTenant();
    stripe.currentPlanLookupKey.mockResolvedValue(
      planLookupKey('GUARD', '1-25'),
    );
    metering.bandDrift.mockResolvedValue({
      drifted: true,
      from: '1-25',
      to: '101-250',
      billableGuards: 180,
    });

    const outcome = await service.sweep();

    expect(outcome.drifted).toHaveLength(1);
    expect(outcome.drifted[0]).toMatchObject({
      tenantName: 'Acme Security',
      packageKey: 'GUARD',
      fromBand: '1-25',
      toBand: '101-250',
      billableGuards: 180,
      currentPrice: 99,
      correctPrice: 399,
      shortfall: 300,
    });
    expect(outcome.monthlyShortfall).toBe(300);
  });

  it('reports nothing when the band is still correct', async () => {
    withTenant();
    stripe.currentPlanLookupKey.mockResolvedValue(
      planLookupKey('GUARD', '26-50'),
    );
    metering.bandDrift.mockResolvedValue({
      drifted: false,
      from: '26-50',
      to: '26-50',
    });

    const outcome = await service.sweep();

    expect(outcome.drifted).toEqual([]);
    expect(outcome.tenantsChecked).toBe(1);
    expect(email.sendBandDriftDigestEmail).not.toHaveBeenCalled();
  });

  // The whole point of the service: it must never reprice anyone. There is no
  // Stripe write available to it, and this asserts the read-only surface stays
  // read-only.
  it('only ever reads from Stripe', async () => {
    withTenant();
    stripe.currentPlanLookupKey.mockResolvedValue(
      planLookupKey('COMPLETE', '1-25'),
    );
    metering.bandDrift.mockResolvedValue({
      drifted: true,
      from: '1-25',
      to: '51-100',
      billableGuards: 70,
    });

    await service.sweep();

    expect(Object.keys(stripe)).toEqual(['currentPlanLookupKey']);
  });

  it('sends one digest for several drifted tenants, not one each', async () => {
    prisma.tenantSubscription.findMany.mockResolvedValue([
      { tenantId: 'tenant-1', tenant: { name: 'Acme' } },
      { tenantId: 'tenant-2', tenant: { name: 'Globex' } },
    ]);
    stripe.currentPlanLookupKey.mockResolvedValue(
      planLookupKey('GUARD', '1-25'),
    );
    metering.bandDrift.mockResolvedValue({
      drifted: true,
      from: '1-25',
      to: '26-50',
      billableGuards: 40,
    });

    const outcome = await service.sweep();

    expect(email.sendBandDriftDigestEmail).toHaveBeenCalledTimes(1);
    expect(email.sendBandDriftDigestEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        recipients: ['billing@example.com'],
        monthlyShortfall: 100,
      }),
    );
    expect(outcome.reported).toBe(true);
  });

  it('logs the drift but sends nothing when no recipient is configured', async () => {
    build(undefined);
    withTenant();
    stripe.currentPlanLookupKey.mockResolvedValue(
      planLookupKey('GUARD', '1-25'),
    );
    metering.bandDrift.mockResolvedValue({
      drifted: true,
      from: '1-25',
      to: '26-50',
      billableGuards: 40,
    });

    const outcome = await service.sweep();

    expect(outcome.drifted).toHaveLength(1);
    expect(outcome.reported).toBe(false);
    expect(email.sendBandDriftDigestEmail).not.toHaveBeenCalled();
  });

  // Generation is a flat price whatever the headcount, so billableBand pins it
  // to the base band and it can never drift. Asserted here so a future change
  // to the pricing rule has to come past this test.
  it('never reports a Generation-only tenant', async () => {
    withTenant();
    stripe.currentPlanLookupKey.mockResolvedValue(
      planLookupKey('GENERATION', '1-25'),
    );
    metering.bandDrift.mockResolvedValue({
      drifted: false,
      from: '1-25',
      to: '1-25',
    });

    expect((await service.sweep()).drifted).toEqual([]);
  });

  it('skips a tenant whose Stripe price is not in the published table', async () => {
    withTenant();
    stripe.currentPlanLookupKey.mockResolvedValue('legacy_handmade_price');

    const outcome = await service.sweep();

    expect(outcome.drifted).toEqual([]);
    expect(metering.bandDrift).not.toHaveBeenCalled();
  });

  it('carries on past a tenant that cannot be read', async () => {
    prisma.tenantSubscription.findMany.mockResolvedValue([
      { tenantId: 'tenant-1', tenant: { name: 'Acme' } },
      { tenantId: 'tenant-2', tenant: { name: 'Globex' } },
    ]);
    stripe.currentPlanLookupKey
      .mockRejectedValueOnce(new Error('Stripe is down'))
      .mockResolvedValue(planLookupKey('GUARD', '1-25'));
    metering.bandDrift.mockResolvedValue({
      drifted: true,
      from: '1-25',
      to: '26-50',
      billableGuards: 40,
    });

    const outcome = await service.sweep();

    expect(outcome.failures).toBe(1);
    expect(outcome.drifted).toHaveLength(1);
  });

  it('does nothing at all when Stripe is not configured', async () => {
    delete process.env.STRIPE_SECRET_KEY;
    withTenant();

    const outcome = await service.sweep();

    expect(outcome.tenantsChecked).toBe(0);
    expect(prisma.tenantSubscription.findMany).not.toHaveBeenCalled();
  });

  it('keeps the finding when the digest fails to send', async () => {
    withTenant();
    stripe.currentPlanLookupKey.mockResolvedValue(
      planLookupKey('GUARD', '1-25'),
    );
    metering.bandDrift.mockResolvedValue({
      drifted: true,
      from: '1-25',
      to: '26-50',
      billableGuards: 40,
    });
    email.sendBandDriftDigestEmail.mockRejectedValue(new Error('SMTP down'));

    const outcome = await service.sweep();

    expect(outcome.drifted).toHaveLength(1);
    expect(outcome.reported).toBe(false);
  });
});
