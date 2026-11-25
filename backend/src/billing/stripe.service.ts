import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import Stripe from 'stripe';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import {
  billingReturnUrls,
  isCheckoutConfigured,
  moduleForPriceId,
  stripeSecretKey,
  stripeWebhookSecret,
  trialDays,
} from './billing.config';
import {
  GENERATION_ONLY_BAND,
  GUARD_BANDS,
  GUARD_BAND_PACKAGE_KEYS,
  GuardBand,
  PACKAGE_KEYS,
  PACKAGE_LABELS,
  PACKAGE_MODULES,
  PackageKey,
  allPlanLookupKeys,
  isCustomQuote,
  monthlyPrice,
  planForLookupKey,
  planLookupKey,
} from './pricing.constants';
import {
  CREDIT_PACKS,
  CreditPackKey,
  creditPackPriceEnvKey,
  creditPackPriceId,
} from './credit-packs.constants';
import {
  LEAD_GEN_TIERS,
  LEAD_GEN_TIER_KEYS,
  LeadGenTier,
  LeadGenTierKey,
  allLeadGenTierLookupKeys,
  leadGenTierForLookupKey,
  leadGenTierLookupKey,
} from './lead-gen-tiers.constants';

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

  /** A sale is a one-invoice coupon; recurring list prices stay intact. */
  async createSaleCoupon(name: string, percentOff: number): Promise<string> {
    const coupon = await this.stripe().coupons.create({
      name: name.trim(),
      percent_off: percentOff,
      duration: 'once',
    });
    return coupon.id;
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

    // Lead Gen tier prices live in the same cache: they are found the same
    // way (by lookup_key) and the plan page needs both in one load.
    const keys = [...allPlanLookupKeys(), ...allLeadGenTierLookupKeys()];
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

  /**
   * Which package/band cells have a live, correctly priced Stripe price.
   *
   * GENERATION always comes back empty: Lead Gen is not sold by band any more.
   * Its tiers are reported by sellableLeadGenTiers() instead.
   */
  async sellablePlans(): Promise<Record<PackageKey, GuardBand[]>> {
    const result = Object.fromEntries(
      PACKAGE_KEYS.map((packageKey) => [packageKey, [] as GuardBand[]]),
    ) as Record<PackageKey, GuardBand[]>;
    if (!isCheckoutConfigured()) return result;

    const prices = await this.planPrices();
    for (const packageKey of GUARD_BAND_PACKAGE_KEYS) {
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
   * Whether the Lead Gen base plan -- the platform fee with no credits -- can
   * be sold. It is the Generation base-band price, which is already in Stripe
   * from before the tiers existed.
   */
  async leadGenBaseSellable(): Promise<boolean> {
    if (!isCheckoutConfigured()) return false;

    const lookupKey = planLookupKey('GENERATION', GENERATION_ONLY_BAND);
    const price = lookupKey
      ? (await this.planPrices()).get(lookupKey)
      : undefined;

    return (
      !!price &&
      this.priceMatchesPlan(price, 'GENERATION', GENERATION_ONLY_BAND)
    );
  }

  /** Which Lead Gen starting plans have a live, correctly priced price. */
  async sellableLeadGenTiers(): Promise<LeadGenTierKey[]> {
    if (!isCheckoutConfigured()) return [];

    const prices = await this.planPrices();
    return LEAD_GEN_TIER_KEYS.filter((key) => {
      const price = prices.get(leadGenTierLookupKey(key));
      return (
        !!price && this.priceMatchesLeadGenTier(price, LEAD_GEN_TIERS[key])
      );
    });
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
    /** Required for GENERATION, which is sold as tiers rather than by band. */
    tier?: LeadGenTierKey;
    email?: string;
  }): Promise<{ url: string | null; changed: boolean }> {
    const { tenantId, packageKey, band, tier, email } = params;

    // Lead Gen with a tier is a starting plan (credits included). Lead Gen
    // with no tier is the base plan, which is the Generation base-band price
    // -- the same $299 price the old flat plan was always sold at. Who is
    // allowed to buy the base plan is decided by the caller.
    const { price, metadata } =
      packageKey === 'GENERATION' && tier
        ? await this.leadGenTierPrice(tenantId, tier)
        : await this.bandPlanPrice(
            tenantId,
            packageKey,
            packageKey === 'GENERATION' ? GENERATION_ONLY_BAND : band,
          );

    const existing = await this.liveSubscriptionFor(tenantId);
    if (existing) {
      await this.stripe().subscriptions.update(existing.id, {
        items: this.itemsAfterBuying(existing, price.id, packageKey),
        proration_behavior: 'create_prorations',
        metadata,
      });
      return { url: null, changed: true };
    }

    const now = new Date();
    const sale = await this.prisma.saleCampaign.findFirst({
      where: {
        enabled: true,
        startsAt: { lte: now },
        endsAt: { gt: now },
        packageKeys: { has: packageKey },
      },
      orderBy: [
        { percentOff: 'desc' },
        { bonusCredits: 'desc' },
        { createdAt: 'asc' },
      ],
    });
    const previousSubscription = sale?.bonusCredits
      ? await this.prisma.tenantSubscription.findUnique({
          where: { tenantId },
          select: { providerSubscriptionId: true },
        })
      : null;
    const firstPaidSubscription = !previousSubscription?.providerSubscriptionId;
    const applicableSale =
      sale && (sale.percentOff > 0 || firstPaidSubscription) ? sale : null;

    const urls = billingReturnUrls();
    // The first discounted invoice is charged immediately. A free trial would
    // defer that invoice until after the festival and make the offer unclear.
    const trial =
      applicableSale || (await this.hasSubscribedBefore(tenantId))
        ? null
        : trialDays();
    const customer = await this.customerIdFor(tenantId, email);
    const offerId =
      applicableSale?.bonusCredits && firstPaidSubscription
        ? randomUUID()
        : null;
    const checkoutMetadata = offerId
      ? { ...metadata, saleOfferId: offerId }
      : metadata;

    const session = await this.stripe().checkout.sessions.create({
      mode: 'subscription',
      customer,
      line_items: [{ price: price.id, quantity: 1 }],
      ...(applicableSale?.stripeCouponId
        ? { discounts: [{ coupon: applicableSale.stripeCouponId }] }
        : {}),
      success_url: urls.success,
      cancel_url: urls.cancel,
      // Carried through to the subscription so every later webhook -- renewal,
      // payment failure, cancellation -- can identify the tenant without a
      // customer lookup. Services are still resolved from the price, never
      // from this.
      metadata: checkoutMetadata,
      subscription_data: {
        metadata: checkoutMetadata,
        ...(trial ? { trial_period_days: trial } : {}),
      },
    });

    if (applicableSale && offerId) {
      await this.prisma.saleCheckoutOffer.create({
        data: {
          id: offerId,
          tenantId,
          campaignId: applicableSale.id,
          campaignName: applicableSale.name,
          packageKey,
          bonusCredits: applicableSale.bonusCredits,
          stripeSessionId: session.id,
        },
      });
    }

    return { url: session.url, changed: false };
  }

  /**
   * What a tenant's subscription items should be after buying `priceId`.
   *
   * Lead Gen is an ADD-ON. A company that patrols sites also prospects for
   * new ones, and until now buying one cancelled the other: the subscription
   * carried a single item, so every purchase replaced whatever was there.
   * That was a billing limitation wearing the costume of a product decision.
   *
   * So a purchase only ever replaces its OWN kind of line:
   *
   *  - Buying Lead Gen replaces an existing Lead Gen line and leaves the
   *    guard-banded package alone.
   *  - Buying a guard-banded package replaces that line and leaves Lead Gen
   *    running -- unless the package is Complete, which already includes Lead
   *    Gen, in which case the add-on is dropped rather than billed twice.
   *
   * Items Stripe is not told about are left untouched, which is what keeps
   * the other line alive. Unrecognised items are still removed: they are
   * pre-package leftovers, and the webhook cannot resolve what they grant.
   */
  private itemsAfterBuying(
    subscription: Stripe.Subscription,
    priceId: string,
    packageKey: PackageKey,
  ): Stripe.SubscriptionUpdateParams.Item[] {
    const buyingLeadGen = packageKey === 'GENERATION';
    // Complete includes Lead Gen, so a separate Lead Gen line under it is the
    // customer paying twice for one product.
    const supersedesLeadGen =
      !buyingLeadGen && PACKAGE_MODULES[packageKey].includes('LEAD_GEN');

    const data = subscription.items.data;
    const kinds = new Map(data.map((item) => [item.id, this.itemKind(item)]));
    const wanted = buyingLeadGen ? 'leadgen' : 'band';

    // Replace the line this purchase is for. With nothing of that kind on the
    // subscription, an unrecognised line is used instead -- a pre-package
    // price being swapped for a current one, which is how every purchase
    // behaved before Lead Gen could stand beside another package.
    const target =
      data.find((item) => kinds.get(item.id) === wanted) ??
      data.find((item) => kinds.get(item.id) === 'unknown');

    const items: Stripe.SubscriptionUpdateParams.Item[] = [];

    for (const item of data) {
      if (item.id === target?.id) {
        items.push({ id: item.id, price: priceId, quantity: 1 });
        continue;
      }

      const kind = kinds.get(item.id);
      if (
        kind === wanted ||
        kind === 'unknown' ||
        (supersedesLeadGen && kind === 'leadgen')
      ) {
        items.push({ id: item.id, deleted: true });
      }
      // Anything else is the other kind of line, and stays as it is.
    }

    if (!target) items.push({ price: priceId, quantity: 1 });
    return items;
  }

  /**
   * Which kind of line an item is. Prices sold before the packages existed
   * are classified by the module their env var maps them to, so a legacy Lead
   * Gen line survives a package purchase the same way a current one does.
   */
  private itemKind(
    item: Stripe.SubscriptionItem,
  ): 'leadgen' | 'band' | 'unknown' {
    const lookupKey = item.price?.lookup_key;

    if (leadGenTierForLookupKey(lookupKey)) return 'leadgen';

    const plan = planForLookupKey(lookupKey);
    // The Lead Gen base plan is sold under the Generation base-band price.
    if (plan) return plan.packageKey === 'GENERATION' ? 'leadgen' : 'band';

    const legacy = item.price?.id ? moduleForPriceId(item.price.id) : null;
    if (legacy === 'LEAD_GEN') return 'leadgen';
    return legacy ? 'band' : 'unknown';
  }

  /**
   * The Stripe price for a guard-band package, with the metadata that rides
   * along on the session and subscription.
   */
  private async bandPlanPrice(
    tenantId: string,
    packageKey: PackageKey,
    band: GuardBand,
  ) {
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

    return {
      price,
      metadata: {
        tenantId,
        package: packageKey,
        band,
        modules: PACKAGE_MODULES[packageKey].join(','),
      },
    };
  }

  /**
   * The Stripe price for a Lead Gen starting plan.
   *
   * The credit count is recorded in metadata for the Dashboard's benefit only
   * -- the webhook reads it back out of the price's lookup_key when it grants
   * the credits, never from here.
   */
  private async leadGenTierPrice(tenantId: string, tier: LeadGenTierKey) {
    const tierDef = LEAD_GEN_TIERS[tier];
    const lookupKey = leadGenTierLookupKey(tier);
    const price = (await this.planPrices()).get(lookupKey);

    if (!price || !this.priceMatchesLeadGenTier(price, tierDef)) {
      this.logger.error(
        `No sellable Stripe price for Lead Gen ${tier}: expected lookup_key ` +
          `${lookupKey} at $${tierDef.price}/month. ` +
          'Run scripts/create-live-stripe-prices.ts.',
      );
      throw new ServiceUnavailableException(
        `The ${tierDef.name} plan can't be bought online right now. Please contact sales.`,
      );
    }

    return {
      price,
      metadata: {
        tenantId,
        package: 'GENERATION',
        leadGenTier: tier,
        includedCredits: String(tierDef.includedCredits),
        modules: PACKAGE_MODULES.GENERATION.join(','),
      },
    };
  }

  /**
   * Whether this tenant has ever held a paid service.
   *
   * Gates the free trial. trial_period_days used to be applied to every new
   * checkout session unconditionally, so a tenant could subscribe, take the
   * trial, cancel before the first invoice, subscribe again and take another
   * one -- indefinitely, for as long as they were willing to re-checkout. The
   * product was free to anyone patient enough to click through it once a
   * month. Harmless only while STRIPE_TRIAL_DAYS was unset, which is not a
   * control.
   *
   * Read from TenantModule rather than subscription status because module
   * rows are deactivated and never deleted (see
   * SubscriptionProvisioningService.provision), so their mere existence is a
   * permanent record that this tenant has been provisioned at some point.
   * Subscription status is current-state and says nothing about history.
   *
   * This also means a hand-provisioned demo or comped tenant gets no trial,
   * which is correct: they already have the product.
   */
  private async hasSubscribedBefore(tenantId: string): Promise<boolean> {
    const previous = await this.prisma.tenantModule.findFirst({
      where: { tenantId },
      select: { id: true },
    });
    return previous !== null;
  }

  /**
   * The lookup_keys of every price the tenant's live subscription is billed
   * on -- plural, because Lead Gen can sit alongside another package, so
   * reading item[0] would report whichever line Stripe happened to list first
   * and call that their plan.
   */
  async currentPlanLookupKeys(tenantId: string): Promise<string[]> {
    const subscription = await this.liveSubscriptionFor(tenantId);
    return (
      subscription?.items.data
        .map((item) => item.price?.lookup_key)
        .filter((key): key is string => Boolean(key)) ?? []
    );
  }

  async hasLiveSubscription(tenantId: string): Promise<boolean> {
    return (await this.liveSubscriptionFor(tenantId)) !== null;
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

  /**
   * A Lead Gen price is only sellable if Stripe agrees with our own list
   * price. The amount is in the lookup_key, so a mismatch means someone edited
   * the price in the Dashboard -- in which case we refuse rather than sell a
   * tier at a price the app will then describe wrongly.
   */
  private priceMatchesLeadGenTier(price: Stripe.Price, tier: LeadGenTier) {
    return (
      price.active &&
      price.currency === 'usd' &&
      price.type === 'recurring' &&
      price.recurring?.interval === 'month' &&
      price.recurring?.interval_count === 1 &&
      price.unit_amount === tier.price * 100
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
   * Checkout session that saves a card for later off-session use, without
   * charging it.
   *
   * `mode: 'setup'` rather than reusing a pack purchase: a tenant enabling
   * auto-recharge is authorising future charges, not buying credits now, and
   * conflating the two would charge them twice the first time.
   */
  async createCardSetupSession(params: { tenantId: string; email?: string }) {
    const { tenantId, email } = params;
    const urls = billingReturnUrls();
    const customer = await this.customerIdFor(tenantId, email);

    const session = await this.stripe().checkout.sessions.create({
      mode: 'setup',
      customer,
      // Explicit: the whole point is a card chargeable while nobody is
      // present, and Stripe's SCA handling differs for off-session use.
      payment_method_types: ['card'],
      success_url: urls.cardSetupSuccess,
      cancel_url: urls.cardSetupCancel,
      metadata: { tenantId, purpose: 'auto_recharge_card' },
    });

    return { url: session.url, sessionId: session.id };
  }

  /**
   * The payment method a completed setup session saved, with the display
   * details we store alongside it.
   *
   * Returns null when the session did not complete or carries no payment
   * method, which is the normal shape of an abandoned card-entry flow.
   */
  async paymentMethodFromSetupSession(sessionId: string): Promise<{
    paymentMethodId: string;
    customerId: string;
    brand: string | null;
    last4: string | null;
  } | null> {
    const session = await this.stripe().checkout.sessions.retrieve(sessionId, {
      expand: ['setup_intent'],
    });

    if (session.mode !== 'setup') return null;

    const setupIntent = session.setup_intent;
    if (!setupIntent || typeof setupIntent === 'string') return null;

    const paymentMethodId =
      typeof setupIntent.payment_method === 'string'
        ? setupIntent.payment_method
        : setupIntent.payment_method?.id;
    if (!paymentMethodId) return null;

    const customerId =
      typeof session.customer === 'string'
        ? session.customer
        : session.customer?.id;
    if (!customerId) return null;

    // Attach so the card survives beyond this session: a payment method left
    // unattached cannot be charged off-session later.
    const method = await this.stripe().paymentMethods.attach(paymentMethodId, {
      customer: customerId,
    });

    return {
      paymentMethodId,
      customerId,
      brand: method.card?.brand ?? null,
      last4: method.card?.last4 ?? null,
    };
  }

  /**
   * Charges a saved card for a credit pack with nobody present.
   *
   * `off_session: true` with `confirm: true` tells Stripe this is an
   * unattended charge against previously authorised card details, so it
   * either succeeds or declines outright rather than returning a challenge
   * no one is there to complete.
   *
   * Throws Stripe's error on decline -- the caller records the attempt and
   * pauses auto-recharge, and needs the decline reason to do it.
   */
  async chargeSavedCardForPack(params: {
    tenantId: string;
    pack: CreditPackKey;
    paymentMethodId: string;
  }) {
    const { tenantId, pack, paymentMethodId } = params;

    const price = creditPackPriceId(pack);
    if (!price) {
      throw new ServiceUnavailableException(
        `No price is configured for the ${CREDIT_PACKS[pack].label} yet.`,
      );
    }

    // Same guard as the interactive path: never charge a price that disagrees
    // with the pack it claims to be.
    await this.assertPriceMatchesPack(price, pack);

    const resolvedPrice = await this.stripe().prices.retrieve(price);
    const amount = resolvedPrice.unit_amount;
    if (amount === null) {
      throw new ServiceUnavailableException(
        `The ${CREDIT_PACKS[pack].label} price has no fixed amount and cannot be charged automatically.`,
      );
    }

    const customer = await this.customerIdFor(tenantId);

    const intent = await this.stripe().paymentIntents.create({
      amount,
      currency: resolvedPrice.currency,
      customer,
      payment_method: paymentMethodId,
      off_session: true,
      confirm: true,
      description: `Auto-recharge: ${CREDIT_PACKS[pack].label}`,
      metadata: {
        tenantId,
        creditPack: pack,
        credits: String(CREDIT_PACKS[pack].credits),
        autoRecharge: 'true',
      },
    });

    return {
      paymentIntentId: intent.id,
      status: intent.status,
      amount,
      currency: resolvedPrice.currency,
    };
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

  /** A charge, for finding the invoice a disputed payment belongs to. */
  async retrieveCharge(chargeId: string) {
    return this.stripe().charges.retrieve(chargeId);
  }
}
