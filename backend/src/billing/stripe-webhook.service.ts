import { Injectable, Logger } from '@nestjs/common';
import Stripe from 'stripe';
import { ServiceModule, SubscriptionStatus } from '@prisma/client';
import { moduleForPriceId } from './billing.config';
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
