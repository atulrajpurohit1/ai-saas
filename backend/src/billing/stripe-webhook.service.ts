import { Injectable, Logger } from '@nestjs/common';
import Stripe from 'stripe';
import { ServiceModule, SubscriptionStatus } from '@prisma/client';
import { moduleForPriceId } from './billing.config';
import { creditPackForPriceId } from './credit-packs.constants';
import { PACKAGE_MODULES, planForLookupKey } from './pricing.constants';
import {
  LeadGenTier,
  leadGenCreditsKey,
  leadGenTierForLookupKey,
} from './lead-gen-tiers.constants';
import { CreditsService } from './credits.service';
import { StripeService } from './stripe.service';
import { SubscriptionProvisioningService } from './subscription-provisioning.service';
import { PendingCompService } from './pending-comp.service';

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
    private readonly pendingComps: PendingCompService,
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

      // A paid Lead Gen invoice is what hands over that month's credit
      // allocation. Subscription state is handled by the subscription events;
      // this one is only about the credits.
      case 'invoice.paid':
        return this.onInvoicePaid(event.data.object as Stripe.Invoice);

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
    // A completed checkout is the tenant deliberately paying. If they were on a
    // complimentary plan (e.g. a Trial comp), that choice ends it: see the
    // `fromCheckout` handling in applySubscription.
    return this.applySubscription(tenantId, subscription, eventId, {
      fromCheckout: true,
    });
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

    // An invoice charge is a subscription payment, not a pack purchase: if it
    // paid for a Lead Gen month, that month's allocation goes back.
    const invoiceId = invoiceIdOf(charge);
    if (invoiceId) {
      return this.reverseLeadGenCredits(
        invoiceId,
        customerIdOf(charge.customer),
        'Lead Gen plan refunded; the credits it included were reversed.',
      );
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

    // A dispute names the charge but not the invoice behind it, so the charge
    // is read back to find out whether this was a subscription payment.
    const chargeId =
      typeof dispute.charge === 'string' ? dispute.charge : dispute.charge?.id;

    if (chargeId) {
      try {
        const charge = await this.stripe.retrieveCharge(chargeId);
        const invoiceId = invoiceIdOf(charge);
        if (invoiceId) {
          return this.reverseLeadGenCredits(
            invoiceId,
            customerIdOf(charge.customer),
            'Lead Gen plan payment disputed; the credits it included were reversed.',
          );
        }
      } catch (error) {
        this.logger.warn(
          `Could not read charge ${chargeId} behind dispute ${dispute.id}: ${
            (error as Error).message
          }`,
        );
      }
    }

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

    if (await this.skipIfComped(tenantId, eventId, 'subscription.deleted')) {
      return { handled: false, tenantId, reason: 'comped-tenant' };
    }

    await this.provisioning.cancel(tenantId, `stripe:${eventId}`);

    // The paid plan has just ended, which is exactly what a queued
    // complimentary plan was waiting for. Activating here rather than leaving
    // it to the hourly sweep means the tenant is never locked out in between,
    // and it catches a cancellation that came early -- before the period end
    // the grant was parked against.
    //
    // Deliberately after cancel(), not instead of it: if activation fails, the
    // subscription is still correctly cancelled and the sweep retries the comp.
    // Errors are swallowed because a 500 here makes Stripe retry the whole
    // event, and the cancellation must not be replayed over a comp that did
    // succeed.
    try {
      const activated = await this.pendingComps.activate(
        tenantId,
        `stripe:${eventId}`,
      );
      if (activated) {
        return { handled: true, tenantId, activatedComp: activated.plan };
      }
    } catch (error) {
      this.logger.error(
        `Cancelled ${tenantId} but could not start their queued comp: ${
          error instanceof Error ? error.message : String(error)
        }. The hourly sweep will retry it.`,
      );
    }

    return { handled: true, tenantId };
  }

  private async onPaymentFailed(invoice: Stripe.Invoice, eventId: string) {
    const customerId =
      typeof invoice.customer === 'string'
        ? invoice.customer
        : invoice.customer?.id;

    const tenantId = await this.provisioning.tenantForProviderIds({ customerId });
    if (!tenantId) return { handled: false, reason: 'unknown-tenant' };

    if (await this.skipIfComped(tenantId, eventId, 'payment.failed')) {
      return { handled: false, tenantId, reason: 'comped-tenant' };
    }

    // PAST_DUE deliberately keeps access. Dunning is a billing conversation,
    // not a reason to strand a customer mid-shift; Stripe retries the payment
    // and only a real cancellation revokes the services.
    await this.provisioning.setStatus(tenantId, 'PAST_DUE', `stripe:${eventId}`);
    return { handled: true, tenantId };
  }

  /**
   * Hands a new Lead Gen subscriber the credits their starting plan includes.
   *
   * ONCE PER PURCHASE, not monthly. The credits are what the Starter/Pro/Elite
   * surcharge buys at the door; they never expire, so there is nothing to
   * refill. Only the plan recurs -- a renewal invoice grants nothing, and a
   * customer who no longer needs credits moves to the base plan.
   *
   * Credits are paid out when the invoice is PAID rather than when the
   * subscription is created, so an unpaid or failed first invoice hands over
   * nothing.
   *
   * Three guards, each protecting a different way to get credits for nothing:
   *
   *  - Only a `subscription_create` invoice counts. `subscription_cycle` is a
   *    renewal, which includes no credits, and `subscription_update` is a
   *    mid-cycle proration -- paying out on either would let a customer mint
   *    credits by waiting, or by switching tier back and forth.
   *  - Nothing is granted for an invoice that collected no money, which is
   *    what a trial's $0 invoice looks like. A trial is a trial; the Trial
   *    plan has its own, smaller grant.
   *  - The grant is keyed on the invoice id, so Stripe's retries -- it
   *    redelivers freely and out of order -- cannot pay the same purchase
   *    twice. The database index enforces it, not a read.
   */
  private async onInvoicePaid(invoice: Stripe.Invoice) {
    const customerId =
      typeof invoice.customer === 'string'
        ? invoice.customer
        : invoice.customer?.id;

    const tenantId =
      invoice.metadata?.tenantId ??
      (await this.provisioning.tenantForProviderIds({ customerId }));

    if (!tenantId) return { handled: false, reason: 'unknown-tenant' };

    // The invoice id is what makes the grant idempotent. Without one there is
    // nothing to key on, and granting anyway would hand out credits again on
    // every redelivery.
    if (!invoice.id) {
      this.logger.warn(
        `A paid invoice for tenant ${tenantId} carries no id; no credits granted.`,
      );
      return { handled: false, tenantId, reason: 'no-invoice-id' };
    }

    const reason = invoice.billing_reason;
    if (reason !== 'subscription_create') {
      return { handled: false, tenantId, reason: `billing-reason:${reason}` };
    }

    const tier = await this.leadGenTierForInvoice(invoice);
    if (!tier) {
      return { handled: false, tenantId, reason: 'not-a-lead-gen-plan' };
    }

    if ((invoice.amount_paid ?? 0) <= 0) {
      this.logger.log(
        `Invoice ${invoice.id} for tenant ${tenantId} collected nothing (likely a trial); ` +
          `withholding the ${tier.includedCredits} ${tier.name} credits until a paid invoice.`,
      );
      return { handled: false, tenantId, reason: 'unpaid-invoice' };
    }

    try {
      const result = await this.credits.grant({
        tenantId,
        amount: tier.includedCredits,
        description: `${tier.name} plan: ${tier.includedCredits.toLocaleString(
          'en-US',
        )} credits included with the plan.`,
        // Doubles as the idempotency key and as the handle a refund reverses
        // the grant by -- see reverseLeadGenCredits.
        stripeSessionId: leadGenCreditsKey(invoice.id),
      });

      this.logger.log(
        result.granted
          ? `Granted ${tier.includedCredits} ${tier.name} credits to ${tenantId} for invoice ${invoice.id}; balance is now ${result.balance}.`
          : `Allocation for invoice ${invoice.id} was already applied to ${tenantId}; balance unchanged at ${result.balance}.`,
      );

      return { handled: true, tenantId, credits: tier.includedCredits };
    } catch (error) {
      // Never throw: a 500 makes Stripe retry the whole event, and the
      // subscription itself is provisioned by a different handler that has
      // already succeeded. Loud log, hand grant if it comes to that.
      this.logger.error(
        `Could not grant ${tier.includedCredits} ${tier.name} credits to ${tenantId} for ` +
          `invoice ${invoice.id}: ${(error as Error).message}`,
      );
      return { handled: false, tenantId, reason: 'grant-failed' };
    }
  }

  /**
   * Which Lead Gen tier an invoice is for, read from the price's lookup_key.
   *
   * The invoice's own lines are preferred, because they are what was actually
   * billed. Stripe has moved the price around on line items between API
   * versions, so when it is not where the SDK types expect, the subscription
   * is read back instead -- for the two billing reasons this is called for,
   * the subscription is still on the tier the invoice charged.
   */
  private async leadGenTierForInvoice(
    invoice: Stripe.Invoice,
  ): Promise<LeadGenTier | null> {
    const lines = invoice.lines?.data ?? [];
    for (const line of lines) {
      const lookupKey = lookupKeyOfLine(line);
      const tier = leadGenTierForLookupKey(lookupKey);
      if (tier) return tier;
    }

    const subscriptionId = subscriptionIdOf(invoice);
    if (!subscriptionId) return null;

    try {
      const subscription =
        await this.stripe.retrieveSubscription(subscriptionId);
      for (const item of subscription.items.data) {
        const tier = leadGenTierForLookupKey(item.price?.lookup_key);
        if (tier) return tier;
      }
    } catch (error) {
      this.logger.warn(
        `Could not read subscription ${subscriptionId} for invoice ${invoice.id}: ${
          (error as Error).message
        }`,
      );
    }

    return null;
  }

  /**
   * Takes back the credits a plan included, when the invoice that paid for
   * them is refunded or charged back.
   *
   * Without this, the subscription equivalent of buy-spend-refund works: buy
   * Pro, take 13,000 credits, dispute the charge, keep the credits. The pack
   * path has had this since launch; credits bundled with a plan are the same
   * money and need the same treatment.
   */
  private async reverseLeadGenCredits(
    invoiceId: string,
    customerId: string | undefined,
    reason: string,
  ) {
    const tenantId = await this.provisioning.tenantForProviderIds({
      customerId,
    });
    if (!tenantId) return { handled: false, reason: 'unknown-tenant' };

    const result = await this.credits.reversePurchase({
      tenantId,
      stripeSessionId: leadGenCreditsKey(invoiceId),
      reason,
    });

    if (!result) {
      return { handled: false, tenantId, reason: 'nothing-to-reverse' };
    }
    return { handled: true, tenantId, reversed: result.reversed };
  }

  /** Applies a Stripe subscription's full state to the tenant. */
  private async applySubscription(
    tenantId: string,
    subscription: Stripe.Subscription,
    eventId: string,
    opts: { fromCheckout?: boolean } = {},
  ) {
    const status = this.statusFor(subscription.status);

    // Normally a comped tenant is off-limits to Stripe (see skipIfComped). The
    // one exception is the tenant buying for real: a completed checkout that
    // produced a LIVE paid subscription (active or trialing) means they have
    // chosen to pay, so their complimentary plan must end immediately rather
    // than block the purchase. provision() below writes the row as STRIPE and
    // clears every comp field, so a Trial comp cannot sit in front of a plan
    // they are now paying for. Anything that is NOT such a purchase -- a
    // subscription.* change, or a checkout that did not go live (incomplete,
    // cancelled) -- keeps the guard that stops a stray event from stripping a
    // comped tenant's modules.
    const endsComp =
      !!opts.fromCheckout && (status === 'ACTIVE' || status === 'TRIALING');

    if (!endsComp) {
      if (await this.skipIfComped(tenantId, eventId, 'subscription.changed')) {
        return { handled: false, tenantId, reason: 'comped-tenant' };
      }
    }

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
      status,
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
   * Refuses to let Stripe write over complimentary access.
   *
   * A comped tenant has no subscription in Stripe, so in the normal case no
   * event ever names them. But a leftover customer id from a past trial, a
   * test-mode event hitting live data, or a tenant comped after once paying
   * can all produce one -- and provision() computes full desired state, so a
   * single such event would strip their modules outright.
   *
   * Logged at warn rather than swallowed: this should be rare, and if it
   * starts happening regularly something upstream needs looking at.
   */
  private async skipIfComped(
    tenantId: string,
    eventId: string,
    handler: string,
  ): Promise<boolean> {
    if (!(await this.provisioning.isComped(tenantId))) return false;

    this.logger.warn(
      `Ignoring ${handler} event ${eventId}: tenant ${tenantId} is on complimentary access, ` +
        'which Stripe does not own. Revoke the comp first if this tenant should be billed.',
    );
    return true;
  }

  /**
   * Resolves services from the price ids Stripe reports, not from metadata.
   * A webhook is untrusted input and metadata is editable in the Dashboard,
   * so what was actually billed is the safer source of truth.
   */
  private modulesFor(subscription: Stripe.Subscription): ServiceModule[] {
    const modules = subscription.items.data.flatMap((item) => {
      // Band-priced plans are recognised by the price's lookup_key, which
      // encodes the package, band and amount (see planLookupKey).
      const plan = planForLookupKey(item.price?.lookup_key);
      if (plan) return PACKAGE_MODULES[plan.packageKey];

      // Lead Gen tiers are flat-priced and carry their own keys. What they
      // unlock is the same LEAD_GEN module whichever tier was bought; the
      // tier only decides how many credits arrive each month.
      if (leadGenTierForLookupKey(item.price?.lookup_key)) {
        return PACKAGE_MODULES.GENERATION;
      }

      // Per-service prices sold before band pricing still map through their
      // STRIPE_PRICE_* env vars, so an older subscription keeps its access.
      const legacy = item.price?.id ? moduleForPriceId(item.price.id) : null;
      return legacy ? [legacy] : [];
    });

    return [...new Set(modules)];
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

function customerIdOf(customer: Stripe.Charge['customer']): string | undefined {
  if (!customer) return undefined;
  return typeof customer === 'string' ? customer : customer.id;
}

/**
 * The invoice a charge paid, if any. Absent on a one-off payment, which is
 * exactly how a credit pack purchase is told apart from a subscription one.
 */
function invoiceIdOf(charge: Stripe.Charge): string | null {
  const invoice = (charge as unknown as { invoice?: string | { id: string } })
    .invoice;
  if (!invoice) return null;
  return typeof invoice === 'string' ? invoice : invoice.id;
}

/**
 * `subscription` sits at the invoice's top level in older API versions and
 * under `parent.subscription_details` in newer ones. Read whichever the
 * account's version actually sends.
 */
function subscriptionIdOf(invoice: Stripe.Invoice): string | null {
  const loose = invoice as unknown as {
    subscription?: string | { id: string } | null;
    parent?: {
      subscription_details?: { subscription?: string | { id: string } | null };
    } | null;
  };

  const direct = loose.subscription;
  if (direct) return typeof direct === 'string' ? direct : direct.id;

  const nested = loose.parent?.subscription_details?.subscription;
  if (nested) return typeof nested === 'string' ? nested : nested.id;

  return null;
}

/**
 * The lookup_key of the price on an invoice line.
 *
 * 2025 API versions replaced the expanded `price` object with `pricing`, which
 * carries the price ID but not its lookup_key -- so on those versions this
 * finds nothing and the caller falls back to reading the subscription.
 */
function lookupKeyOfLine(line: Stripe.InvoiceLineItem): string | null {
  const loose = line as unknown as {
    price?: { lookup_key?: string | null } | null;
  };

  return loose.price?.lookup_key ?? null;
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
