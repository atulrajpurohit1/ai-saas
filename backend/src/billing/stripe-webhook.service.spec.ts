import { Test } from '@nestjs/testing';
import Stripe from 'stripe';
import { StripeService } from './stripe.service';
import { StripeWebhookService } from './stripe-webhook.service';
import { SubscriptionProvisioningService } from './subscription-provisioning.service';

const PRICE_LEAD_GEN = 'price_lead_gen_monthly';
const PRICE_GUARD_TOUR = 'price_guard_tour_monthly';
const PRICE_FINANCE = 'price_finance_annual';

function subscription(
  overrides: Partial<Stripe.Subscription> & { priceIds?: string[] } = {},
): Stripe.Subscription {
  const { priceIds = [PRICE_LEAD_GEN], ...rest } = overrides;

  return {
    id: 'sub_123',
    customer: 'cus_123',
    status: 'active',
    cancel_at_period_end: false,
    trial_end: null,
    metadata: { tenantId: 'tenant-1' },
    items: {
      data: priceIds.map((id) => ({
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
  let stripe: { retrieveSubscription: jest.Mock };

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
    stripe = { retrieveSubscription: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        StripeWebhookService,
        { provide: StripeService, useValue: stripe },
        { provide: SubscriptionProvisioningService, useValue: provisioning },
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
