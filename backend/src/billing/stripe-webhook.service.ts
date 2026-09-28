import { Injectable, Logger } from '@nestjs/common';
import Stripe from 'stripe';
import { ServiceModule, SubscriptionStatus } from '@prisma/client';
import { moduleForPriceId } from './billing.config';
import { creditPackForPriceId } from './credit-packs.constants';
import { CreditsService } from './credits.service';
import { StripeService } from './stripe.service';
import { SubscriptionProvisioningService } from './subscription-provisioning.service';

/**
 * Translates Stripe events into entitlement changes.
 *
 * Three properties matter here, because Stripe retries failed deliveries and
 * does not guarantee ordering:
 *
 *  - Idempotent. Every handler computes the full desired state and calls
 *    provision(), so replaying an event changes nothing.
 *  - Order-independent. Handlers never apply a delta; the same event arriving
 *    twice, or after a later one, converges on the same state.
 *  - Never throws for an event we do not handle. A 500 makes Stripe retry
 *    forever and eventually disable the endpoint.
 */
@Injectable()
export class StripeWebhookService {
  private readonly logger = new Logger(StripeWebhookService.name);

  constructor(
    private readonly stripe: StripeService,
    private readonly provisioning: SubscriptionProvisioningService,
    private readonly credits: CreditsService,
  ) {}

  async handle(event: Stripe.Event) {
    switch (event.type) {
      case 'checkout.session.completed':
        return this.onCheckoutCompleted(
          event.data.object as Stripe.Checkout.Session,
          event.id,
        );

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        return this.onSubscriptionChanged(
          event.data.object as Stripe.Subscription,
          event.id,
        );

      case 'customer.subscription.deleted':
        return this.onSubscriptionDeleted(
          event.data.object as Stripe.Subscription,
          event.id,
        );

      case 'invoice.payment_failed':
        return this.onPaymentFailed(
          event.data.object as Stripe.Invoice,
          event.id,
        );

      // A refunded or disputed credit purchase must take the credits back,
      // otherwise a customer can buy, spend, refund and keep the usage.
      case 'charge.refunded':
        return this.onChargeRefunded(event.data.object as Stripe.Charge);

      case 'charge.dispute.created':
        return this.onChargeDisputed(event.data.object as Stripe.Dispute);

      default:
        this.logger.debug(`Ignoring unhandled Stripe event ${event.type}`);
        return { handled: false, reason: `unhandled:${event.type}` };
    }
  }

  private async onCheckoutCompleted(
    session: Stripe.Checkout.Session,
    eventId: string,
  ) {
    const tenantId = session.metadata?.tenantId;

    // A one-off payment is a credit pack, not a subscription. Branch before the
    // subscription checks below, which would otherwise reject it as missing a
    // subscription id.
    if (session.mode === 'payment') {
      return this.onCreditPackPurchased(session);
    }

    const subscriptionId =
      typeof session.subscription === 'string'
        ? session.subscription
        : session.subscription?.id;

    if (!tenantId || !subscriptionId) {
      this.logger.warn(
        `checkout.session.completed ${session.id} has no tenantId/subscription; ignoring.`,
      );
      return { handled: false, reason: 'missing-identifiers' };
    }

    // Read the subscription back rather than trusting the session: it is the
    // authoritative record of what was actually bought, and it carries the
    // period and trial dates the session does not.
    const subscription = await this.stripe.retrieveSubscription(subscriptionId);
    return this.applySubscription(tenantId, subscription, eventId);
  }

  /**
   * Grants credits for a completed pack purchase.
   *
   * The credit amount comes from the price id Stripe reports on the session's
   * line items, never from session metadata: metadata is editable in the
   * Dashboard, so treating it as authoritative would let an edited session mint
   * arbitrary credits. Idempotency is the unique index on stripe_session_id --
   * a redelivered event finds the row already there and grants nothing.
   */
  private async onCreditPackPurchased(session: Stripe.Checkout.Session) {
    const tenantId = session.metadata?.tenantId;

    if (!tenantId) {
      this.logger.warn(
        `Credit pack checkout ${session.id} carries no tenantId; ignoring.`,
      );
      return { handled: false, reason: 'missing-tenant' };
    }

    if (session.payment_status !== 'paid') {
      this.logger.log(
        `Credit pack checkout ${session.id} is ${session.payment_status}, not paid; no credits granted.`,
      );
      return { handled: false, reason: 'unpaid' };
    }

    const priceIds = await this.stripe.priceIdsForCheckoutSession(session.id);
    const pack = priceIds
      .map((priceId) => creditPackForPriceId(priceId))
      .find((candidate) => candidate !== null);

    if (!pack) {
      this.logger.error(
        `Credit pack checkout ${session.id} has no price id matching a configured pack (saw: ${
          priceIds.join(', ') || 'none'
        }); no credits granted.`,
      );
      return { handled: false, reason: 'unknown-pack' };
    }

    const result = await this.credits.grant({
      tenantId,
      amount: pack.credits,
      description: `${pack.label}: ${pack.credits} Prospect Search credits.`,
      stripeSessionId: session.id,
    });

    this.logger.log(
      result.granted
        ? `Granted ${pack.credits} credits to tenant ${tenantId} from ${session.id}; balance is now ${result.balance}.`
        : `Credit pack ${session.id} was already applied for tenant ${tenantId}; balance unchanged at ${result.balance}.`,
    );

    return { handled: true, tenantId, credits: pack.credits };
  }

  /**
   * Claws back credits when a pack purchase is refunded.
   *
   * Only full refunds reverse the grant: a partial refund is a judgement call
   * about how many credits it corresponds to, and getting that wrong
   * automatically is worse than leaving it for a human. Partial refunds are
   * logged loudly instead.
   */
  private async onChargeRefunded(charge: Stripe.Charge) {
    const paymentIntentId =
      typeof charge.payment_intent === 'string'
        ? charge.payment_intent
        : charge.payment_intent?.id;

    if (!paymentIntentId) {
      return { handled: false, reason: 'no-payment-intent' };
    }

    if (charge.amount_refunded < charge.amount) {
      this.logger.warn(
        `Charge ${charge.id} was partially refunded (${charge.amount_refunded} of ${charge.amount}); credits NOT reversed automatically. Adjust by hand if this was a credit pack.`,
      );
      return { handled: false, reason: 'partial-refund' };
    }

    return this.reverseCreditsForPaymentIntent(
      paymentIntentId,
      'Credit pack refunded; credits reversed.',
    );
  }

  /**
   * Treats a chargeback the same as a refund. The money is gone the moment the
   * dispute is raised, so waiting for it to resolve would leave the credits
   * spendable in the meantime.
   */
  private async onChargeDisputed(dispute: Stripe.Dispute) {
    const paymentIntentId =
      typeof dispute.payment_intent === 'string'
        ? dispute.payment_intent
        : dispute.payment_intent?.id;

    if (!paymentIntentId) {
      return { handled: false, reason: 'no-payment-intent' };
    }

    return this.reverseCreditsForPaymentIntent(
      paymentIntentId,
      'Credit pack payment disputed; credits reversed.',
    );
  }

  private async reverseCreditsForPaymentIntent(
    paymentIntentId: string,
    reason: string,
  ) {
    const session =
      await this.stripe.checkoutSessionForPaymentIntent(paymentIntentId);

    // Subscription invoices refund through this event too, and they have no
    // credit grant behind them -- not an error, just not ours to handle.
    if (!session || session.mode !== 'payment') {
      return { handled: false, reason: 'not-a-credit-purchase' };
    }

    const tenantId = session.metadata?.tenantId;
    if (!tenantId) {
      this.logger.warn(
        `Refunded session ${session.id} carries no tenantId; cannot reverse credits.`,
      );
      return { handled: false, reason: 'missing-tenant' };
    }

    const result = await this.credits.reversePurchase({
      tenantId,
      stripeSessionId: session.id,
      reason,
    });

    if (!result) {
      return { handled: false, reason: 'nothing-to-reverse' };
    }

    return { handled: true, tenantId, reversed: result.reversed };
  }

  private async onSubscriptionChanged(
    subscription: Stripe.Subscription,
    eventId: string,
  ) {
    const tenantId = await this.resolveTenant(subscription);
    if (!tenantId) {
      this.logger.warn(
        `Subscription ${subscription.id} maps to no known tenant; ignoring.`,
      );
      return { handled: false, reason: 'unknown-tenant' };
    }
    return this.applySubscription(tenantId, subscription, eventId);
  }

  private async onSubscriptionDeleted(
    subscription: Stripe.Subscription,
    eventId: string,
  ) {
    const tenantId = await this.resolveTenant(subscription);
    if (!tenantId) return { handled: false, reason: 'unknown-tenant' };

    await this.provisioning.cancel(tenantId, `stripe:${eventId}`);
    return { handled: true, tenantId };
  }

  private async onPaymentFailed(invoice: Stripe.Invoice, eventId: string) {
    const customerId =
      typeof invoice.customer === 'string'
        ? invoice.customer
        : invoice.customer?.id;

    const tenantId = await this.provisioning.tenantForProviderIds({ customerId });
    if (!tenantId) return { handled: false, reason: 'unknown-tenant' };

    // PAST_DUE deliberately keeps access. Dunning is a billing conversation,
    // not a reason to strand a customer mid-shift; Stripe retries the payment
    // and only a real cancellation revokes the services.
    await this.provisioning.setStatus(tenantId, 'PAST_DUE', `stripe:${eventId}`);
    return { handled: true, tenantId };
  }

  /** Applies a Stripe subscription's full state to the tenant. */
  private async applySubscription(
    tenantId: string,
    subscription: Stripe.Subscription,
    eventId: string,
  ) {
    const modules = this.modulesFor(subscription);

    if (!modules.length) {
      // Every price on the subscription is unknown to us -- most likely a
      // price id that was never added to the env config. Provisioning nothing
      // would silently strip a paying customer, so refuse instead and let it
      // surface as an unhandled event.
      this.logger.error(
        `Subscription ${subscription.id} has no recognised price ids; refusing to provision. ` +
          'Check the STRIPE_PRICE_* env vars match the Dashboard.',
      );
      return { handled: false, reason: 'no-known-prices' };
    }

    await this.provisioning.provision({
      tenantId,
      modules,
      status: this.statusFor(subscription.status),
      trialEndsAt: toDate(subscription.trial_end),
      currentPeriodEnd: currentPeriodEnd(subscription),
      cancelAtPeriodEnd: subscription.cancel_at_period_end ?? false,
      providerCustomerId:
        typeof subscription.customer === 'string'
          ? subscription.customer
          : subscription.customer?.id,
      providerSubscriptionId: subscription.id,
      reason: `stripe:${eventId}`,
    });

    return { handled: true, tenantId, modules };
  }

  /**
   * Resolves services from the price ids Stripe reports, not from metadata.
   * A webhook is untrusted input and metadata is editable in the Dashboard,
   * so what was actually billed is the safer source of truth.
   */
  private modulesFor(subscription: Stripe.Subscription): ServiceModule[] {
    const fromPrices = subscription.items.data
      .map((item) => item.price?.id)
      .filter((id): id is string => Boolean(id))
      .map(moduleForPriceId)
      .filter((module): module is ServiceModule => module !== null);

    return [...new Set(fromPrices)];
  }

  private statusFor(status: Stripe.Subscription.Status): SubscriptionStatus {
    switch (status) {
      case 'trialing':
        return 'TRIALING';
      case 'active':
        return 'ACTIVE';
      case 'past_due':
      case 'unpaid':
        return 'PAST_DUE';
      case 'canceled':
      case 'incomplete_expired':
        return 'CANCELED';
      case 'incomplete':
      case 'paused':
      default:
        // Not yet paid for, or paused. Treat as cancelled: access should not
        // begin until money has actually changed hands.
        return 'CANCELED';
    }
  }

  private async resolveTenant(subscription: Stripe.Subscription) {
    const fromMetadata = subscription.metadata?.tenantId;
    if (fromMetadata) return fromMetadata;

    return this.provisioning.tenantForProviderIds({
      subscriptionId: subscription.id,
      customerId:
        typeof subscription.customer === 'string'
          ? subscription.customer
          : subscription.customer?.id,
    });
  }
}

function toDate(seconds?: number | null) {
  return seconds ? new Date(seconds * 1000) : null;
}

/**
 * `current_period_end` moved onto subscription items in recent API versions
 * and is absent from the top level in the SDK types. Read whichever the
 * account's API version actually sends.
 */
function currentPeriodEnd(subscription: Stripe.Subscription): Date | null {
  const top = (subscription as unknown as { current_period_end?: number })
    .current_period_end;
  if (top) return toDate(top);

  const fromItems = subscription.items?.data
    ?.map(
      (item) =>
        (item as unknown as { current_period_end?: number }).current_period_end,
    )
    .filter((value): value is number => typeof value === 'number');

  return fromItems?.length ? toDate(Math.max(...fromItems)) : null;
}
