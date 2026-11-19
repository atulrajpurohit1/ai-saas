import { Test } from '@nestjs/testing';
import Stripe from 'stripe';
import { StripeService } from './stripe.service';
import { StripeWebhookService } from './stripe-webhook.service';
import { SubscriptionProvisioningService } from './subscription-provisioning.service';
import { CreditsService } from './credits.service';
import { PendingCompService } from './pending-comp.service';
import { EmailService } from '../email/email.service';
import {
  LEAD_GEN_TIERS,
  leadGenCreditsKey,
  leadGenPurchaseKey,
  leadGenTierLookupKey,
} from './lead-gen-tiers.constants';

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
    isComped: jest.Mock;
  };
  let stripe: {
    retrieveSubscription: jest.Mock;
    priceIdsForCheckoutSession: jest.Mock;
    checkoutSessionForPaymentIntent: jest.Mock;
    retrieveCharge: jest.Mock;
  };
  let credits: { grant: jest.Mock; reversePurchase: jest.Mock };
  let pendingComps: { activate: jest.Mock };
  let email: { sendCreditPurchaseNotification: jest.Mock };

  beforeEach(async () => {
    process.env.STRIPE_PRICE_LEAD_GEN_MONTHLY = PRICE_LEAD_GEN;
    process.env.STRIPE_PRICE_GUARD_TOUR_MONTHLY = PRICE_GUARD_TOUR;
    process.env.STRIPE_PRICE_FINANCE_ANNUAL = PRICE_FINANCE;

    provisioning = {
      provision: jest.fn().mockResolvedValue({}),
      cancel: jest.fn().mockResolvedValue(undefined),
      setStatus: jest.fn().mockResolvedValue(undefined),
      tenantForProviderIds: jest.fn().mockResolvedValue('tenant-1'),
      isComped: jest.fn().mockResolvedValue(false),
    };
    stripe = {
      retrieveSubscription: jest.fn(),
      priceIdsForCheckoutSession: jest.fn().mockResolvedValue([]),
      checkoutSessionForPaymentIntent: jest.fn().mockResolvedValue(null),
      retrieveCharge: jest.fn().mockResolvedValue({ invoice: null }),
    };
    credits = {
      grant: jest.fn().mockResolvedValue({ balance: 250, granted: true }),
      reversePurchase: jest
        .fn()
        .mockResolvedValue({ reversed: 1000, balance: -200 }),
    };
    // No queued comp by default, which is the ordinary case for every tenant.
    pendingComps = { activate: jest.fn().mockResolvedValue(null) };
    email = {
      sendCreditPurchaseNotification: jest
        .fn()
        .mockResolvedValue({ sent: true }),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        StripeWebhookService,
        { provide: StripeService, useValue: stripe },
        { provide: SubscriptionProvisioningService, useValue: provisioning },
        { provide: CreditsService, useValue: credits },
        { provide: PendingCompService, useValue: pendingComps },
        { provide: EmailService, useValue: email },
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

    it('starts a queued free plan the moment the paid plan ends', async () => {
      pendingComps.activate.mockResolvedValue({ plan: 'TRIAL' });

      const result = await service.handle(
        event('customer.subscription.deleted', subscription()),
      );

      expect(pendingComps.activate).toHaveBeenCalledWith(
        'tenant-1',
        'stripe:evt_1',
      );
      expect(result).toMatchObject({ handled: true, activatedComp: 'TRIAL' });
    });

    it('still reports the cancellation when the queued plan fails to start', async () => {
      pendingComps.activate.mockRejectedValue(new Error('db down'));

      const result = await service.handle(
        event('customer.subscription.deleted', subscription()),
      );

      // The sweep retries it; throwing would make Stripe replay the event.
      expect(provisioning.cancel).toHaveBeenCalled();
      expect(result).toMatchObject({ handled: true, tenantId: 'tenant-1' });
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

    // The client wants purchases in the same inbox as new signups.
    it('notifies the team that credits were bought', async () => {
      stripe.priceIdsForCheckoutSession.mockResolvedValue([PRICE_CREDITS_PRO]);

      await service.handle(event('checkout.session.completed', packSession()));

      expect(email.sendCreditPurchaseNotification).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        packLabel: 'Pro Pack',
        credits: 13000,
        amount: 249,
        balance: 250,
        source: 'self-service purchase',
      });
    });

    // Stripe redelivers events. The grant is idempotent on the session id, so
    // a replay grants nothing -- and must not mail a second time either.
    it('does not notify again when a replayed event grants nothing', async () => {
      stripe.priceIdsForCheckoutSession.mockResolvedValue([PRICE_CREDITS_PRO]);
      credits.grant.mockResolvedValue({ balance: 13250, granted: false });

      await service.handle(event('checkout.session.completed', packSession()));

      expect(email.sendCreditPurchaseNotification).not.toHaveBeenCalled();
    });

    it('still handles the purchase when the notification fails', async () => {
      stripe.priceIdsForCheckoutSession.mockResolvedValue([PRICE_CREDITS_PRO]);
      email.sendCreditPurchaseNotification.mockRejectedValue(
        new Error('SMTP down'),
      );

      const result = await service.handle(
        event('checkout.session.completed', packSession()),
      );

      expect(result).toEqual({
        handled: true,
        tenantId: 'tenant-1',
        credits: 13000,
      });
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
  describe('credits included with a Lead Gen plan', () => {
    const PRO_KEY = leadGenTierLookupKey('PRO');

    const invoice = (overrides: Record<string, unknown> = {}) =>
      ({
        id: 'in_1',
        customer: 'cus_123',
        subscription: 'sub_123',
        billing_reason: 'subscription_create',
        amount_paid: 54_800,
        lines: { data: [{ price: { lookup_key: PRO_KEY } }] },
        ...overrides,
      }) as unknown as Stripe.Invoice;

    it('provisions Lead Gen from a tier price', async () => {
      stripe.retrieveSubscription.mockResolvedValue(
        subscription({ lookupKeys: [PRO_KEY] }),
      );

      await service.handle(
        event('checkout.session.completed', {
          id: 'cs_1',
          subscription: 'sub_123',
          metadata: { tenantId: 'tenant-1' },
        }),
      );

      expect(provisioning.provision).toHaveBeenCalledWith(
        expect.objectContaining({ modules: ['LEAD_GEN'] }),
      );
    });

    // The add-on shape: two lines on one subscription. The module set is the
    // union of what each line sells, so neither cancels the other.
    it('provisions Guard and Lead Gen from a subscription carrying both', async () => {
      stripe.retrieveSubscription.mockResolvedValue(
        subscription({
          lookupKeys: ['aegislead_guard_26_50_149usd_monthly', PRO_KEY],
        }),
      );

      await service.handle(
        event('customer.subscription.updated', {
          id: 'sub_123',
          customer: 'cus_123',
          status: 'active',
          metadata: { tenantId: 'tenant-1' },
          items: {
            data: [
              { price: { lookup_key: 'aegislead_guard_26_50_149usd_monthly' } },
              { price: { lookup_key: PRO_KEY } },
            ],
          },
        }),
      );

      expect(provisioning.provision).toHaveBeenCalledWith(
        expect.objectContaining({
          modules: expect.arrayContaining([
            'GUARD_TOUR',
            'LEAD_GEN',
          ]) as string[],
        }),
      );
    });

    it('grants the credits when the plan is first paid for', async () => {
      await service.handle(event('invoice.paid', invoice()));

      expect(credits.grant).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-1',
          amount: LEAD_GEN_TIERS.PRO.includedCredits,
          // The subscription-and-tier key is what makes it a one-time grant.
          idempotencyKey: leadGenPurchaseKey('sub_123', 'PRO'),
          stripeSessionId: leadGenCreditsKey('in_1'),
        }),
      );
    });

    /**
     * Credits bundled with a plan are not a credit purchase. The internal
     * alert is specifically about someone BUYING credits -- a pack, or an
     * automatic top-up -- so subscribing to Lead Gen must not trigger it,
     * even though credits land as a result.
     */
    it('does not send the credit-purchase alert for a plan grant', async () => {
      await service.handle(event('invoice.paid', invoice()));

      expect(email.sendCreditPurchaseNotification).not.toHaveBeenCalled();
    });

    /**
     * A customer who already pays for Guard and adds Lead Gen mid-cycle is
     * invoiced a proration, not a new subscription. They have bought the
     * plan and are owed its credits -- filtering this out was the bug that
     * would have charged add-on customers $548 for nothing.
     */
    it('grants the credits on a mid-cycle add-on', async () => {
      await service.handle(
        event(
          'invoice.paid',
          invoice({
            billing_reason: 'subscription_update',
            amount_paid: 18_000,
          }),
        ),
      );

      expect(credits.grant).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: LEAD_GEN_TIERS.PRO.includedCredits,
          idempotencyKey: leadGenPurchaseKey('sub_123', 'PRO'),
        }),
      );
    });

    /**
     * The credits are bought once and never expire, so a renewal owes
     * nothing. That is enforced by the key rather than by the billing
     * reason: a renewal asks under the key the purchase already used, and
     * the ledger's unique index refuses it.
     */
    it('asks under the same key on a renewal, which the ledger refuses', async () => {
      credits.grant.mockResolvedValue({ balance: 13_000, granted: false });

      const result = await service.handle(
        event(
          'invoice.paid',
          invoice({ billing_reason: 'subscription_cycle' }),
        ),
      );

      expect(credits.grant).toHaveBeenCalledWith(
        expect.objectContaining({
          idempotencyKey: leadGenPurchaseKey('sub_123', 'PRO'),
        }),
      );
      expect(result).toMatchObject({ handled: true });
    });

    // Switching tier is a different purchase, so it carries a different key.
    it('keys an upgrade to a different tier separately', async () => {
      const STARTER_KEY = leadGenTierLookupKey('STARTER');
      await service.handle(
        event(
          'invoice.paid',
          invoice({
            lines: { data: [{ price: { lookup_key: STARTER_KEY } }] },
          }),
        ),
      );

      expect(credits.grant).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: LEAD_GEN_TIERS.STARTER.includedCredits,
          idempotencyKey: leadGenPurchaseKey('sub_123', 'STARTER'),
        }),
      );
    });

    it('grants nothing for an invoice that is not a subscription', async () => {
      const result = await service.handle(
        event('invoice.paid', invoice({ billing_reason: 'manual' })),
      );

      expect(credits.grant).not.toHaveBeenCalled();
      expect(result).toMatchObject({ handled: false });
    });

    // A trial's invoice is paid, for $0. Credits are what the money buys.
    it('grants nothing for an invoice that collected no money', async () => {
      await service.handle(event('invoice.paid', invoice({ amount_paid: 0 })));

      expect(credits.grant).not.toHaveBeenCalled();
    });

    it('grants nothing for a plan that is not Lead Gen', async () => {
      stripe.retrieveSubscription.mockResolvedValue(
        subscription({ lookupKeys: ['aegislead_guard_1_25_99usd_monthly'] }),
      );

      await service.handle(
        event(
          'invoice.paid',
          invoice({
            lines: {
              data: [
                { price: { lookup_key: 'aegislead_guard_1_25_99usd_monthly' } },
              ],
            },
            subscription: 'sub_123',
          }),
        ),
      );

      expect(credits.grant).not.toHaveBeenCalled();
    });

    // Newer API versions drop the expanded price from invoice lines, leaving
    // the subscription as the only place the tier can be read from.
    it('falls back to the subscription when the line carries no lookup key', async () => {
      stripe.retrieveSubscription.mockResolvedValue(
        subscription({ lookupKeys: [PRO_KEY] }),
      );

      await service.handle(
        event(
          'invoice.paid',
          invoice({
            lines: {
              data: [{ pricing: { price_details: { price: 'price_x' } } }],
            },
            subscription: 'sub_123',
          }),
        ),
      );

      expect(credits.grant).toHaveBeenCalledWith(
        expect.objectContaining({ amount: LEAD_GEN_TIERS.PRO.includedCredits }),
      );
    });

    it('reads the subscription id from the newer parent shape', async () => {
      stripe.retrieveSubscription.mockResolvedValue(
        subscription({ lookupKeys: [PRO_KEY] }),
      );

      await service.handle(
        event(
          'invoice.paid',
          invoice({
            lines: { data: [{}] },
            parent: { subscription_details: { subscription: 'sub_123' } },
          }),
        ),
      );

      expect(stripe.retrieveSubscription).toHaveBeenCalledWith('sub_123');
      expect(credits.grant).toHaveBeenCalled();
    });

    // Stripe redelivers webhooks freely; the grant is keyed on the invoice.
    it('reports the replay rather than granting twice', async () => {
      credits.grant.mockResolvedValue({ balance: 13_000, granted: false });

      const result = await service.handle(event('invoice.paid', invoice()));

      expect(result).toMatchObject({ handled: true, tenantId: 'tenant-1' });
      expect(credits.grant).toHaveBeenCalledTimes(1);
    });

    it('does not fail the event when the grant throws', async () => {
      credits.grant.mockRejectedValue(new Error('db down'));

      const result = await service.handle(event('invoice.paid', invoice()));

      expect(result).toMatchObject({ handled: false, reason: 'grant-failed' });
    });

    it('takes the allocation back when the invoice is refunded', async () => {
      await service.handle(
        event('charge.refunded', {
          id: 'ch_1',
          payment_intent: 'pi_1',
          customer: 'cus_123',
          invoice: 'in_1',
          amount: 54_800,
          amount_refunded: 54_800,
        }),
      );

      expect(credits.reversePurchase).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-1',
          stripeSessionId: leadGenCreditsKey('in_1'),
        }),
      );
    });

    it('takes the allocation back on a chargeback', async () => {
      stripe.retrieveCharge.mockResolvedValue({
        id: 'ch_1',
        invoice: 'in_1',
        customer: 'cus_123',
      });

      await service.handle(
        event('charge.dispute.created', {
          id: 'dp_1',
          charge: 'ch_1',
          payment_intent: 'pi_1',
        }),
      );

      expect(credits.reversePurchase).toHaveBeenCalledWith(
        expect.objectContaining({
          stripeSessionId: leadGenCreditsKey('in_1'),
        }),
      );
    });
  });

  it('ignores unhandled event types without throwing', async () => {
    await expect(
      service.handle(event('customer.created', { id: 'cus_9' })),
    ).resolves.toEqual({
      handled: false,
      reason: 'unhandled:customer.created',
    });
  });

  /**
   * Complimentary access is not Stripe's to manage.
   *
   * These matter more than they look. provision() computes the tenant's FULL
   * desired state, so a single subscription event naming a comped tenant --
   * from a stale customer id, a test-mode event reaching live data, or a
   * tenant comped after once paying -- would strip every module they have.
   * The customer's first symptom would be being locked out.
   */
  describe('comped tenants', () => {
    const PRICE_CREDITS_PRO = 'price_credits_pro';

    beforeEach(() => {
      provisioning.isComped.mockResolvedValue(true);
      process.env.STRIPE_PRICE_CREDITS_PRO = PRICE_CREDITS_PRO;
    });

    afterEach(() => {
      delete process.env.STRIPE_PRICE_CREDITS_PRO;
    });

    it('does not reprovision a comped tenant on a subscription change', async () => {
      const result = await service.handle(
        event('customer.subscription.updated', subscription()),
      );

      expect(provisioning.provision).not.toHaveBeenCalled();
      expect(result).toMatchObject({ handled: false, reason: 'comped-tenant' });
    });

    /**
     * The tenant actually paying is the one case that overrides a comp. A
     * completed checkout for a live paid subscription provisions through the
     * normal STRIPE path, which clears every comp field -- so a Trial comp
     * expires the moment the paid plan is bought rather than silently blocking
     * it (which would charge the customer while leaving them on Trial).
     */
    it('ends a comp when the tenant completes a real checkout', async () => {
      stripe.retrieveSubscription.mockResolvedValue(
        subscription({ priceIds: [PRICE_LEAD_GEN], status: 'active' }),
      );

      const result = await service.handle(
        event('checkout.session.completed', {
          id: 'cs_paid_1',
          subscription: 'sub_123',
          metadata: { tenantId: 'tenant-1' },
        }),
      );

      expect(provisioning.provision).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-1',
          modules: ['LEAD_GEN'],
          status: 'ACTIVE',
        }),
      );
      expect(result).toMatchObject({ handled: true, modules: ['LEAD_GEN'] });
    });

    // A checkout that never went live (payment incomplete) is not the tenant
    // paying, so it must NOT strip their comp.
    it('keeps a comp when a checkout did not produce a live subscription', async () => {
      stripe.retrieveSubscription.mockResolvedValue(
        subscription({ priceIds: [PRICE_LEAD_GEN], status: 'incomplete' }),
      );

      const result = await service.handle(
        event('checkout.session.completed', {
          id: 'cs_unpaid_1',
          subscription: 'sub_123',
          metadata: { tenantId: 'tenant-1' },
        }),
      );

      expect(provisioning.provision).not.toHaveBeenCalled();
      expect(result).toMatchObject({ handled: false, reason: 'comped-tenant' });
    });

    it('does not cancel a comped tenant when a subscription is deleted', async () => {
      const result = await service.handle(
        event('customer.subscription.deleted', subscription()),
      );

      expect(provisioning.cancel).not.toHaveBeenCalled();
      expect(result).toMatchObject({ handled: false, reason: 'comped-tenant' });
    });

    it('does not mark a comped tenant PAST_DUE on a failed payment', async () => {
      const result = await service.handle(
        event('invoice.payment_failed', { customer: 'cus_123' }),
      );

      expect(provisioning.setStatus).not.toHaveBeenCalled();
      expect(result).toMatchObject({ handled: false, reason: 'comped-tenant' });
    });

    /**
     * Credits are the other half of the deal: the owner gives the plan away,
     * the customer still buys their own tokens. If a comp blocked credit
     * purchases the whole arrangement would fall over, so the comp check must
     * sit only on the subscription handlers.
     */
    it('still grants credits a comped tenant has paid for', async () => {
      stripe.priceIdsForCheckoutSession.mockResolvedValue([PRICE_CREDITS_PRO]);

      const result = await service.handle(
        event('checkout.session.completed', {
          id: 'cs_credits_1',
          mode: 'payment',
          payment_status: 'paid',
          metadata: { tenantId: 'tenant-1', creditPack: 'PRO' },
        }),
      );

      expect(credits.grant).toHaveBeenCalled();
      expect(result).toMatchObject({ handled: true });
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
