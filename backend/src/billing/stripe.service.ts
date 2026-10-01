import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import Stripe from 'stripe';
import { PrismaService } from '../prisma/prisma.service';
import {
  billingReturnUrls,
  isCheckoutConfigured,
  stripeSecretKey,
  stripeWebhookSecret,
  trialDays,
} from './billing.config';
import {
  GUARD_BANDS,
  GuardBand,
  PACKAGE_KEYS,
  PACKAGE_LABELS,
  PACKAGE_MODULES,
  PackageKey,
  allPlanLookupKeys,
  isCustomQuote,
  monthlyPrice,
  planLookupKey,
} from './pricing.constants';
import {
  CREDIT_PACKS,
  CreditPackKey,
  creditPackPriceEnvKey,
  creditPackPriceId,
} from './credit-packs.constants';

/**
 * Thin wrapper over the Stripe SDK.
 *
 * Constructed lazily: the app must boot and run normally with no Stripe keys
 * configured, which is the state it is in until the client provides them.
 * Every method that needs Stripe throws 503 with an explicit message rather
 * than failing obscurely at startup.
 */
@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private client: Stripe | null = null;

  constructor(private readonly prisma: PrismaService) {}

  get configured() {
    return isCheckoutConfigured();
  }

  private stripe(): Stripe {
    if (!this.client) {
      const key = stripeSecretKey();
      if (!key) {
        throw new ServiceUnavailableException(
          'Payments are not configured yet. Set STRIPE_SECRET_KEY to enable checkout.',
        );
      }
      this.client = new Stripe(key);
    }
    return this.client;
  }

  /**
   * Reuses the tenant's Stripe customer if we already have one, so a customer
   * adding a second service does not end up with two customer records and two
   * unrelated invoices.
   */
  private async customerIdFor(tenantId: string, email?: string) {
    const existing = await this.prisma.tenantSubscription.findUnique({
      where: { tenantId },
      select: { providerCustomerId: true },
    });
    if (existing?.providerCustomerId) return existing.providerCustomerId;

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true },
    });

    const customer = await this.stripe().customers.create({
      name: tenant?.name ?? undefined,
      email,
      // tenantId on the customer means a Stripe-side lookup can always find
      // its way back to us, even if a webhook arrives without our metadata.
      metadata: { tenantId },
    });

    return customer.id;
  }

  /**
   * Live plan prices keyed by lookup_key, cached briefly: the plan page asks
   * on every load, and the set only changes when someone runs the price script.
   */
  private planPriceCache: {
    at: number;
    prices: Map<string, Stripe.Price>;
  } | null = null;

  async planPrices(): Promise<Map<string, Stripe.Price>> {
    if (
      this.planPriceCache &&
      Date.now() - this.planPriceCache.at < 5 * 60_000
    ) {
      return this.planPriceCache.prices;
    }

    const keys = allPlanLookupKeys();
    const prices = new Map<string, Stripe.Price>();
    // Stripe accepts at most 10 lookup keys per list call.
    for (let index = 0; index < keys.length; index += 10) {
      const page = await this.stripe().prices.list({
        lookup_keys: keys.slice(index, index + 10),
        active: true,
        limit: 10,
      });
      for (const price of page.data) {
        if (price.lookup_key) prices.set(price.lookup_key, price);
      }
    }

    this.planPriceCache = { at: Date.now(), prices };
    return prices;
  }

  /** Which package/band cells have a live, correctly priced Stripe price. */
  async sellablePlans(): Promise<Record<PackageKey, GuardBand[]>> {
    const result = Object.fromEntries(
      PACKAGE_KEYS.map((packageKey) => [packageKey, [] as GuardBand[]]),
    ) as Record<PackageKey, GuardBand[]>;
    if (!isCheckoutConfigured()) return result;

    const prices = await this.planPrices();
    for (const packageKey of PACKAGE_KEYS) {
      for (const { key: band } of GUARD_BANDS) {
        const lookupKey = planLookupKey(packageKey, band);
        const price = lookupKey ? prices.get(lookupKey) : undefined;
        if (price && this.priceMatchesPlan(price, packageKey, band)) {
          result[packageKey].push(band);
        }
      }
    }
    return result;
  }

  /**
   * Starts, or changes, the tenant's subscription to one package at one guard
   * band. The caller is responsible for not letting a tenant pick a band below
   * the guards they actually run.
   *
   * A tenant that already has a live Stripe subscription is moved onto the new
   * price instead of being sent through checkout again: a second subscription
   * would bill them twice, and the webhook tracks one subscription per tenant,
   * so the older one would silently stop being followed.
   */
  async createPlanCheckoutSession(params: {
    tenantId: string;
    packageKey: PackageKey;
    band: GuardBand;
    email?: string;
  }): Promise<{ url: string | null; changed: boolean }> {
    const { tenantId, packageKey, band, email } = params;

    if (isCustomQuote(band)) {
      throw new BadRequestException(
        'Plans for more than 500 guards are quoted individually. Please contact sales.',
      );
    }

    const lookupKey = planLookupKey(packageKey, band);
    const price = lookupKey
      ? (await this.planPrices()).get(lookupKey)
      : undefined;

    if (!price || !this.priceMatchesPlan(price, packageKey, band)) {
      this.logger.error(
        `No sellable Stripe price for ${packageKey} at ${band}: expected lookup_key ` +
          `${lookupKey ?? 'none'} at $${monthlyPrice(packageKey, band)}/month. ` +
          'Run scripts/create-live-stripe-prices.ts.',
      );
      throw new ServiceUnavailableException(
        `${PACKAGE_LABELS[packageKey]} can't be bought online right now. Please contact sales.`,
      );
    }

    const metadata = {
      tenantId,
      package: packageKey,
      band,
      modules: PACKAGE_MODULES[packageKey].join(','),
    };

    const existing = await this.liveSubscriptionFor(tenantId);
    if (existing) {
      const [first, ...rest] = existing.items.data;
      await this.stripe().subscriptions.update(existing.id, {
        items: [
          { id: first.id, price: price.id, quantity: 1 },
          // Older subscriptions carried one item per service; a package is a
          // single price, so the rest go.
          ...rest.map((item) => ({ id: item.id, deleted: true })),
        ],
        proration_behavior: 'create_prorations',
        metadata,
      });
      return { url: null, changed: true };
    }

    const urls = billingReturnUrls();
    const trial = trialDays();
    const customer = await this.customerIdFor(tenantId, email);

    const session = await this.stripe().checkout.sessions.create({
      mode: 'subscription',
      customer,
      line_items: [{ price: price.id, quantity: 1 }],
      success_url: urls.success,
      cancel_url: urls.cancel,
      // Carried through to the subscription so every later webhook -- renewal,
      // payment failure, cancellation -- can identify the tenant without a
      // customer lookup. Services are still resolved from the price, never
      // from this.
      metadata,
      subscription_data: {
        metadata,
        ...(trial ? { trial_period_days: trial } : {}),
      },
    });

    return { url: session.url, changed: false };
  }

  /** The lookup_key of the price the tenant's live subscription is on. */
  async currentPlanLookupKey(tenantId: string): Promise<string | null> {
    const subscription = await this.liveSubscriptionFor(tenantId);
    return subscription?.items.data[0]?.price?.lookup_key ?? null;
  }

  private priceMatchesPlan(
    price: Stripe.Price,
    packageKey: PackageKey,
    band: GuardBand,
  ) {
    const amount = monthlyPrice(packageKey, band);
    return (
      amount !== null &&
      price.active &&
      price.currency === 'usd' &&
      price.type === 'recurring' &&
      price.recurring?.interval === 'month' &&
      price.recurring?.interval_count === 1 &&
      price.unit_amount === amount * 100
    );
  }

  /** The tenant's Stripe subscription, if it is one Stripe will still bill. */
  private async liveSubscriptionFor(tenantId: string) {
    const record = await this.prisma.tenantSubscription.findUnique({
      where: { tenantId },
      select: { providerSubscriptionId: true },
    });
    if (!record?.providerSubscriptionId) return null;

    const subscription = await this.stripe().subscriptions.retrieve(
      record.providerSubscriptionId,
    );
    const live: Stripe.Subscription.Status[] = [
      'active',
      'trialing',
      'past_due',
      'unpaid',
    ];
    return live.includes(subscription.status) ? subscription : null;
  }

  /**
   * One-off checkout for a Prospect Search credit pack.
   *
   * `mode: 'payment'` rather than 'subscription': credit packs are bought
   * outright, not billed on a cycle. The tenant's existing Stripe customer is
   * reused, so a pack purchase lands on the same customer record as their
   * subscription rather than creating a second one.
   */
  async createCreditPackCheckoutSession(params: {
    tenantId: string;
    pack: CreditPackKey;
    email?: string;
  }) {
    const { tenantId, pack, email } = params;

    const price = creditPackPriceId(pack);
    if (!price) {
      throw new ServiceUnavailableException(
        `No price is configured for the ${CREDIT_PACKS[pack].label} yet.`,
      );
    }

    await this.assertPriceMatchesPack(price, pack);

    const urls = billingReturnUrls();
    const customer = await this.customerIdFor(tenantId, email);

    const session = await this.stripe().checkout.sessions.create({
      mode: 'payment',
      customer,
      line_items: [{ price, quantity: 1 }],
      success_url: urls.creditsSuccess,
      cancel_url: urls.creditsCancel,
      // The webhook re-reads the purchased price id and resolves the credit
      // amount from that, never from this metadata -- metadata is editable in
      // the Dashboard, so it is a cross-check only.
      metadata: {
        tenantId,
        creditPack: pack,
        credits: String(CREDIT_PACKS[pack].credits),
      },
      payment_intent_data: {
        metadata: { tenantId, creditPack: pack },
      },
    });

    return { url: session.url, sessionId: session.id };
  }

  /**
   * Refuses to sell a pack whose configured Stripe price does not charge what
   * the pack says.
   *
   * The webhook grants the credit amount from CREDIT_PACKS, keyed by price id,
   * while Stripe charges whatever the price itself says. The two are set in
   * different places -- the constants in code, the price id in the host's env
   * -- so changing a pack's size without replacing its price id would sell the
   * new credits at the old price. That happened to be possible on the day the
   * packs were resized: the Starter key kept its env var while its credits
   * went from 250 to 3,000, so a stale $99 price id would have sold 3,000
   * credits for $99. Checking here makes that drift fail closed.
   */
  private async assertPriceMatchesPack(priceId: string, pack: CreditPackKey) {
    const expected = CREDIT_PACKS[pack];
    const price = await this.stripe().prices.retrieve(priceId);

    const matches =
      price.active &&
      price.type === 'one_time' &&
      price.currency === 'usd' &&
      price.unit_amount === expected.price * 100;

    if (!matches) {
      this.logger.error(
        `Refusing to sell the ${expected.label}: price ${priceId} charges ` +
          `${price.unit_amount ?? 'unknown'} ${price.currency} (${price.type}, ` +
          `${price.active ? 'active' : 'archived'}), but the pack is ` +
          `$${expected.price} one-time for ${expected.credits} credits. ` +
          `Set ${creditPackPriceEnvKey(pack)} to the matching price.`,
      );
      throw new ServiceUnavailableException(
        `The ${expected.label} can't be bought right now. Please try again later.`,
      );
    }
  }

  /**
   * The checkout session a payment intent belongs to, if any.
   *
   * A refund arrives as `charge.refunded`, which carries a payment intent, not a
   * session -- but the credit purchase is recorded against the session id. This
   * closes that gap so a refund can find the grant it needs to reverse.
   */
  async checkoutSessionForPaymentIntent(
    paymentIntentId: string,
  ): Promise<Stripe.Checkout.Session | null> {
    const sessions = await this.stripe().checkout.sessions.list({
      payment_intent: paymentIntentId,
      limit: 1,
    });
    return sessions.data[0] ?? null;
  }

  /** The price ids on a completed one-off checkout, for resolving the pack. */
  async priceIdsForCheckoutSession(sessionId: string): Promise<string[]> {
    const lineItems = await this.stripe().checkout.sessions.listLineItems(
      sessionId,
      { limit: 100 },
    );
    return lineItems.data
      .map((item) => item.price?.id)
      .filter((id): id is string => Boolean(id));
  }

  /** Stripe-hosted page for cards, invoices, plan changes and cancellation. */
  async createPortalSession(tenantId: string) {
    const subscription = await this.prisma.tenantSubscription.findUnique({
      where: { tenantId },
      select: { providerCustomerId: true },
    });

    if (!subscription?.providerCustomerId) {
      throw new BadRequestException(
        'This account has no payment record yet. Purchase a service first.',
      );
    }

    const session = await this.stripe().billingPortal.sessions.create({
      customer: subscription.providerCustomerId,
      return_url: billingReturnUrls().portalReturn,
    });

    return { url: session.url };
  }

  /**
   * Verifies a webhook against the signing secret.
   *
   * Without this anyone who finds the endpoint could grant themselves every
   * service by POSTing a fake `checkout.session.completed`, so an unverifiable
   * payload is rejected outright rather than parsed.
   */
  constructEvent(rawBody: Buffer, signature: string): Stripe.Event {
    const secret = stripeWebhookSecret();
    if (!secret) {
      throw new ServiceUnavailableException(
        'Webhooks are not configured. Set STRIPE_WEBHOOK_SECRET.',
      );
    }

    try {
      return this.stripe().webhooks.constructEvent(rawBody, signature, secret);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      this.logger.warn(`Rejected webhook with a bad signature: ${message}`);
      throw new BadRequestException('Invalid webhook signature.');
    }
  }

  /** The price ids actually on a subscription, for resolving modules. */
  async priceIdsForSubscription(subscriptionId: string): Promise<string[]> {
    const subscription =
      await this.stripe().subscriptions.retrieve(subscriptionId);
    return subscription.items.data
      .map((item) => item.price?.id)
      .filter((id): id is string => Boolean(id));
  }

  async retrieveSubscription(subscriptionId: string) {
    return this.stripe().subscriptions.retrieve(subscriptionId);
  }
}
