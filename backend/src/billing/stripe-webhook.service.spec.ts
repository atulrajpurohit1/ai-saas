import { Test } from '@nestjs/testing';
import Stripe from 'stripe';
import { StripeService } from './stripe.service';
import { StripeWebhookService } from './stripe-webhook.service';
import { SubscriptionProvisioningService } from './subscription-provisioning.service';
import { CreditsService } from './credits.service';

const PRICE_LEAD_GEN = 'price_lead_gen_monthly';
const PRICE_GUARD_TOUR = 'price_guard_tour_monthly';
const PRICE_FINANCE = 'price_finance_annual';

function subscription(
  overrides: Partial<Stripe.Subscription> & {
    priceIds?: string[];
    lookupKeys?: string[];
  } = {},
): Stripe.Subscription {
  const { priceIds = [PRICE_LEAD_GEN], lookupKeys, ...rest } = overrides;

  return {
    id: 'sub_123',
    customer: 'cus_123',
    status: 'active',
    cancel_at_period_end: false,
    trial_end: null,
    metadata: { tenantId: 'tenant-1' },
    items: {
      data: lookupKeys
        ? lookupKeys.map((lookup_key, index) => ({
            price: { id: `price_plan_${index}`, lookup_key },
            current_period_end: 1_800_000_000,
          }))
        : priceIds.map((id) => ({
            price: { id },
            current_period_end: 1_800_000_000,
          })),
    },
    ...rest,
  } as unknown as Stripe.Subscription;
}

const event = (type: string, object: unknown, id = 'evt_1') =>
  ({ id, type, data: { object } }) as unknown as Stripe.Event;

describe('StripeWebhookService', () => {
  let service: StripeWebhookService;
  let provisioning: {
    provision: jest.Mock;
    cancel: jest.Mock;
    setStatus: jest.Mock;
    tenantForProviderIds: jest.Mock;
  };
  let stripe: {
    retrieveSubscription: jest.Mock;
    priceIdsForCheckoutSession: jest.Mock;
    checkoutSessionForPaymentIntent: jest.Mock;
  };
  let credits: { grant: jest.Mock; reversePurchase: jest.Mock };

  beforeEach(async () => {
    process.env.STRIPE_PRICE_LEAD_GEN_MONTHLY = PRICE_LEAD_GEN;
    process.env.STRIPE_PRICE_GUARD_TOUR_MONTHLY = PRICE_GUARD_TOUR;
    process.env.STRIPE_PRICE_FINANCE_ANNUAL = PRICE_FINANCE;

    provisioning = {
      provision: jest.fn().mockResolvedValue({}),
      cancel: jest.fn().mockResolvedValue(undefined),
      setStatus: jest.fn().mockResolvedValue(undefined),
      tenantForProviderIds: jest.fn().mockResolvedValue('tenant-1'),
    };
    stripe = {
      retrieveSubscription: jest.fn(),
      priceIdsForCheckoutSession: jest.fn().mockResolvedValue([]),
      checkoutSessionForPaymentIntent: jest.fn().mockResolvedValue(null),
    };
    credits = {
      grant: jest.fn().mockResolvedValue({ balance: 250, granted: true }),
      reversePurchase: jest
        .fn()
        .mockResolvedValue({ reversed: 1000, balance: -200 }),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        StripeWebhookService,
        { provide: StripeService, useValue: stripe },
        { provide: SubscriptionProvisioningService, useValue: provisioning },
        { provide: CreditsService, useValue: credits },
      ],
    }).compile();

    service = moduleRef.get(StripeWebhookService);
  });

  afterEach(() => {
    delete process.env.STRIPE_PRICE_LEAD_GEN_MONTHLY;
    delete process.env.STRIPE_PRICE_GUARD_TOUR_MONTHLY;
    delete process.env.STRIPE_PRICE_FINANCE_ANNUAL;
  });

  describe('checkout.session.completed', () => {
    it('provisions the services actually billed', async () => {
      stripe.retrieveSubscription.mockResolvedValue(
        subscription({ priceIds: [PRICE_LEAD_GEN] }),
      );

      await service.handle(
        event('checkout.session.completed', {
          id: 'cs_1',
          subscription: 'sub_123',
          metadata: { tenantId: 'tenant-1' },
        }),
      );

      expect(provisioning.provision).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-1',
          modules: ['LEAD_GEN'],
          status: 'ACTIVE',
          providerSubscriptionId: 'sub_123',
        }),
      );
    });

    // Band-priced plans carry no env var: the service set comes from the
    // price's lookup_key, which names the package.
    it('provisions every service in a Complete plan from its lookup key', async () => {
      stripe.retrieveSubscription.mockResolvedValue(
        subscription({
          lookupKeys: ['aegislead_complete_51_100_849usd_monthly'],
        }),
      );

      await service.handle(
        event('checkout.session.completed', {
          id: 'cs_1',
          subscription: 'sub_123',
          metadata: { tenantId: 'tenant-1' },
        }),
      );

      expect(provisioning.provision).toHaveBeenCalledWith(
        expect.objectContaining({
          modules: expect.arrayContaining(['LEAD_GEN', 'GUARD_TOUR', 'FINANCE']),
        }),
      );
    });

    it('provisions only Guard Tour for a Guard plan', async () => {
      stripe.retrieveSubscription.mockResolvedValue(
        subscription({ lookupKeys: ['aegislead_guard_26_50_149usd_monthly'] }),
      );

      await service.handle(
        event('checkout.session.completed', {
          id: 'cs_1',
          subscription: 'sub_123',
          metadata: { tenantId: 'tenant-1' },
        }),
      );

      expect(provisioning.provision).toHaveBeenCalledWith(
        expect.objectContaining({ modules: ['GUARD_TOUR'] }),
      );
    });

    it('ignores a session with no tenant', async () => {
      const result = await service.handle(
        event('checkout.session.completed', {
          id: 'cs_1',
          subscription: 'sub_123',
          metadata: {},
        }),
      );

      expect(result).toEqual({ handled: false, reason: 'missing-identifiers' });
      expect(provisioning.provision).not.toHaveBeenCalled();
    });

    // Metadata is editable in the Stripe Dashboard; what was billed is not.
    it('trusts the billed prices over the session metadata', async () => {
      stripe.retrieveSubscription.mockResolvedValue(
        subscription({ priceIds: [PRICE_LEAD_GEN] }),
      );

      await service.handle(
        event('checkout.session.completed', {
          id: 'cs_1',
          subscription: 'sub_123',
          metadata: {
            tenantId: 'tenant-1',
            modules: 'LEAD_GEN,GUARD_TOUR,FINANCE',
          },
        }),
      );

      expect(provisioning.provision).toHaveBeenCalledWith(
        expect.objectContaining({ modules: ['LEAD_GEN'] }),
      );
    });
  });

  describe('customer.subscription.updated', () => {
    it('provisions every purchased service', async () => {
      await service.handle(
        event(
          'customer.subscription.updated',
          subscription({ priceIds: [PRICE_LEAD_GEN, PRICE_FINANCE] }),
        ),
      );

      expect(provisioning.provision).toHaveBeenCalledWith(
        expect.objectContaining({ modules: ['LEAD_GEN', 'FINANCE'] }),
      );
    });

    it.each([
      ['trialing', 'TRIALING'],
      ['active', 'ACTIVE'],
      ['past_due', 'PAST_DUE'],
      ['unpaid', 'PAST_DUE'],
      ['canceled', 'CANCELED'],
      ['incomplete', 'CANCELED'],
      ['incomplete_expired', 'CANCELED'],
    ])('maps Stripe status %s to %s', async (stripeStatus, expected) => {
      await service.handle(
        event(
          'customer.subscription.updated',
          subscription({ status: stripeStatus as Stripe.Subscription.Status }),
        ),
      );

      expect(provisioning.provision).toHaveBeenCalledWith(
        expect.objectContaining({ status: expected }),
      );
    });

    it('carries the trial end date through', async () => {
      await service.handle(
        event(
          'customer.subscription.updated',
          subscription({ status: 'trialing', trial_end: 1_700_000_000 }),
        ),
      );

      expect(provisioning.provision).toHaveBeenCalledWith(
        expect.objectContaining({
          trialEndsAt: new Date(1_700_000_000 * 1000),
        }),
      );
    });

    it('reads current_period_end from the subscription items', async () => {
      await service.handle(
        event('customer.subscription.updated', subscription()),
      );

      expect(provisioning.provision).toHaveBeenCalledWith(
        expect.objectContaining({
          currentPeriodEnd: new Date(1_800_000_000 * 1000),
        }),
      );
    });

    it('falls back to provider ids when metadata has no tenant', async () => {
      await service.handle(
        event('customer.subscription.updated', subscription({ metadata: {} })),
      );

      expect(provisioning.tenantForProviderIds).toHaveBeenCalledWith({
        subscriptionId: 'sub_123',
        customerId: 'cus_123',
      });
      expect(provisioning.provision).toHaveBeenCalled();
    });

    it('ignores a subscription belonging to no known tenant', async () => {
      provisioning.tenantForProviderIds.mockResolvedValue(null);

      const result = await service.handle(
        event('customer.subscription.updated', subscription({ metadata: {} })),
      );

      expect(result).toEqual({ handled: false, reason: 'unknown-tenant' });
      expect(provisioning.provision).not.toHaveBeenCalled();
    });

    // Provisioning an empty module list would silently strip a paying
    // customer of everything, so an unrecognised price must refuse instead.
    it('refuses to provision when no price id is recognised', async () => {
      const result = await service.handle(
        event(
          'customer.subscription.updated',
          subscription({ priceIds: ['price_not_in_our_config'] }),
        ),
      );

      expect(result).toEqual({ handled: false, reason: 'no-known-prices' });
      expect(provisioning.provision).not.toHaveBeenCalled();
    });
  });

  describe('customer.subscription.deleted', () => {
    it('cancels the tenant subscription', async () => {
      await service.handle(
        event('customer.subscription.deleted', subscription()),
      );

      expect(provisioning.cancel).toHaveBeenCalledWith(
        'tenant-1',
        'stripe:evt_1',
      );
    });
  });

  describe('invoice.payment_failed', () => {
    // Dunning is a billing conversation, not a reason to strand a customer.
    it('marks PAST_DUE without revoking services', async () => {
      await service.handle(
        event('invoice.payment_failed', { customer: 'cus_123' }),
      );

      expect(provisioning.setStatus).toHaveBeenCalledWith(
        'tenant-1',
        'PAST_DUE',
        'stripe:evt_1',
      );
      expect(provisioning.cancel).not.toHaveBeenCalled();
      expect(provisioning.provision).not.toHaveBeenCalled();
    });
  });

  describe('credit pack purchases', () => {
    const PRICE_CREDITS_PRO = 'price_credits_pro';

    beforeEach(() => {
      process.env.STRIPE_PRICE_CREDITS_PRO = PRICE_CREDITS_PRO;
    });

    afterEach(() => {
      delete process.env.STRIPE_PRICE_CREDITS_PRO;
    });

    const packSession = (overrides: Record<string, unknown> = {}) => ({
      id: 'cs_credits_1',
      mode: 'payment',
      payment_status: 'paid',
      metadata: { tenantId: 'tenant-1', creditPack: 'PRO' },
      ...overrides,
    });

    it('grants the credits the purchased price actually sells', async () => {
      stripe.priceIdsForCheckoutSession.mockResolvedValue([
        PRICE_CREDITS_PRO,
      ]);

      const result = await service.handle(
        event('checkout.session.completed', packSession()),
      );

      expect(credits.grant).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-1',
          amount: 13000,
          // The session id is what makes a replayed webhook a no-op.
          stripeSessionId: 'cs_credits_1',
        }),
      );
      expect(result).toEqual({
        handled: true,
        tenantId: 'tenant-1',
        credits: 13000,
      });
      // A one-off payment must never be mistaken for a subscription.
      expect(provisioning.provision).not.toHaveBeenCalled();
    });

    // Session metadata is editable in the Stripe Dashboard, so trusting it
    // would let an edited session mint arbitrary credits.
    it('ignores a credit figure in metadata that the price does not back', async () => {
      stripe.priceIdsForCheckoutSession.mockResolvedValue([
        PRICE_CREDITS_PRO,
      ]);

      await service.handle(
        event(
          'checkout.session.completed',
          packSession({
            metadata: {
              tenantId: 'tenant-1',
              creditPack: 'PRO',
              credits: '999999',
            },
          }),
        ),
      );

      expect(credits.grant).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 13000 }),
      );
    });

    it('grants nothing when the price matches no configured pack', async () => {
      stripe.priceIdsForCheckoutSession.mockResolvedValue(['price_unknown']);

      const result = await service.handle(
        event('checkout.session.completed', packSession()),
      );

      expect(credits.grant).not.toHaveBeenCalled();
      expect(result).toEqual({ handled: false, reason: 'unknown-pack' });
    });

    it('grants nothing for a session that has not been paid', async () => {
      const result = await service.handle(
        event(
          'checkout.session.completed',
          packSession({ payment_status: 'unpaid' }),
        ),
      );

      expect(credits.grant).not.toHaveBeenCalled();
      expect(result).toEqual({ handled: false, reason: 'unpaid' });
    });

    it('ignores a pack session carrying no tenant', async () => {
      const result = await service.handle(
        event('checkout.session.completed', packSession({ metadata: {} })),
      );

      expect(credits.grant).not.toHaveBeenCalled();
      expect(result).toEqual({ handled: false, reason: 'missing-tenant' });
    });
  });

  describe('refunds and disputes', () => {
    const packSessionForRefund = {
      id: 'cs_credits_1',
      mode: 'payment',
      metadata: { tenantId: 'tenant-1' },
    };

    const charge = (overrides: Record<string, unknown> = {}) => ({
      id: 'ch_1',
      payment_intent: 'pi_1',
      amount: 29900,
      amount_refunded: 29900,
      ...overrides,
    });

    it('reverses the credits when a pack purchase is fully refunded', async () => {
      stripe.checkoutSessionForPaymentIntent.mockResolvedValue(
        packSessionForRefund,
      );

      const result = await service.handle(event('charge.refunded', charge()));

      expect(credits.reversePurchase).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-1',
          stripeSessionId: 'cs_credits_1',
        }),
      );
      expect(result).toEqual({
        handled: true,
        tenantId: 'tenant-1',
        reversed: 1000,
      });
    });

    // Guessing how many credits a partial refund corresponds to is worse than
    // leaving it to a human.
    it('leaves a partial refund alone', async () => {
      const result = await service.handle(
        event('charge.refunded', charge({ amount_refunded: 10000 })),
      );

      expect(credits.reversePurchase).not.toHaveBeenCalled();
      expect(result).toEqual({ handled: false, reason: 'partial-refund' });
    });

    it('reverses the credits on a chargeback', async () => {
      stripe.checkoutSessionForPaymentIntent.mockResolvedValue(
        packSessionForRefund,
      );

      const result = await service.handle(
        event('charge.dispute.created', {
          id: 'dp_1',
          payment_intent: 'pi_1',
        }),
      );

      expect(credits.reversePurchase).toHaveBeenCalled();
      expect(result).toEqual({
        handled: true,
        tenantId: 'tenant-1',
        reversed: 1000,
      });
    });

    // Subscription invoices refund through the same event and have no credit
    // grant behind them.
    it('ignores a refund that is not a credit purchase', async () => {
      stripe.checkoutSessionForPaymentIntent.mockResolvedValue({
        id: 'cs_sub_1',
        mode: 'subscription',
        metadata: { tenantId: 'tenant-1' },
      });

      const result = await service.handle(event('charge.refunded', charge()));

      expect(credits.reversePurchase).not.toHaveBeenCalled();
      expect(result).toEqual({
        handled: false,
        reason: 'not-a-credit-purchase',
      });
    });

    it('reports nothing-to-reverse when no grant is found', async () => {
      stripe.checkoutSessionForPaymentIntent.mockResolvedValue(
        packSessionForRefund,
      );
      credits.reversePurchase.mockResolvedValue(null);

      const result = await service.handle(event('charge.refunded', charge()));

      expect(result).toEqual({
        handled: false,
        reason: 'nothing-to-reverse',
      });
    });
  });

  // Stripe retries on any non-2xx and eventually disables an endpoint that
  // keeps failing, so an event we do not care about must not throw.
  it('ignores unhandled event types without throwing', async () => {
    await expect(
      service.handle(event('customer.created', { id: 'cus_9' })),
    ).resolves.toEqual({
      handled: false,
      reason: 'unhandled:customer.created',
    });
  });

  // Stripe does not guarantee once-only delivery or ordering.
  it('is idempotent across a replayed event', async () => {
    const replayed = event('customer.subscription.updated', subscription());

    await service.handle(replayed);
    await service.handle(replayed);

    expect(provisioning.provision).toHaveBeenCalledTimes(2);
    const [first, second] = provisioning.provision.mock.calls;
    expect(first[0]).toEqual(second[0]);
  });
});
