"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var StripeService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.StripeService = void 0;
const common_1 = require("@nestjs/common");
const stripe_1 = __importDefault(require("stripe"));
const prisma_service_1 = require("../prisma/prisma.service");
const billing_config_1 = require("./billing.config");
const pricing_constants_1 = require("./pricing.constants");
const credit_packs_constants_1 = require("./credit-packs.constants");
let StripeService = StripeService_1 = class StripeService {
    prisma;
    logger = new common_1.Logger(StripeService_1.name);
    client = null;
    constructor(prisma) {
        this.prisma = prisma;
    }
    get configured() {
        return (0, billing_config_1.isCheckoutConfigured)();
    }
    stripe() {
        if (!this.client) {
            const key = (0, billing_config_1.stripeSecretKey)();
            if (!key) {
                throw new common_1.ServiceUnavailableException('Payments are not configured yet. Set STRIPE_SECRET_KEY to enable checkout.');
            }
            this.client = new stripe_1.default(key);
        }
        return this.client;
    }
    async customerIdFor(tenantId, email) {
        const existing = await this.prisma.tenantSubscription.findUnique({
            where: { tenantId },
            select: { providerCustomerId: true },
        });
        if (existing?.providerCustomerId)
            return existing.providerCustomerId;
        const tenant = await this.prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { name: true },
        });
        const customer = await this.stripe().customers.create({
            name: tenant?.name ?? undefined,
            email,
            metadata: { tenantId },
        });
        return customer.id;
    }
    planPriceCache = null;
    async planPrices() {
        if (this.planPriceCache &&
            Date.now() - this.planPriceCache.at < 5 * 60_000) {
            return this.planPriceCache.prices;
        }
        const keys = (0, pricing_constants_1.allPlanLookupKeys)();
        const prices = new Map();
        for (let index = 0; index < keys.length; index += 10) {
            const page = await this.stripe().prices.list({
                lookup_keys: keys.slice(index, index + 10),
                active: true,
                limit: 10,
            });
            for (const price of page.data) {
                if (price.lookup_key)
                    prices.set(price.lookup_key, price);
            }
        }
        this.planPriceCache = { at: Date.now(), prices };
        return prices;
    }
    async sellablePlans() {
        const result = Object.fromEntries(pricing_constants_1.PACKAGE_KEYS.map((packageKey) => [packageKey, []]));
        if (!(0, billing_config_1.isCheckoutConfigured)())
            return result;
        const prices = await this.planPrices();
        for (const packageKey of pricing_constants_1.PACKAGE_KEYS) {
            for (const { key: band } of pricing_constants_1.GUARD_BANDS) {
                const lookupKey = (0, pricing_constants_1.planLookupKey)(packageKey, band);
                const price = lookupKey ? prices.get(lookupKey) : undefined;
                if (price && this.priceMatchesPlan(price, packageKey, band)) {
                    result[packageKey].push(band);
                }
            }
        }
        return result;
    }
    async createPlanCheckoutSession(params) {
        const { tenantId, packageKey, band, email } = params;
        if ((0, pricing_constants_1.isCustomQuote)(band)) {
            throw new common_1.BadRequestException('Plans for more than 500 guards are quoted individually. Please contact sales.');
        }
        const lookupKey = (0, pricing_constants_1.planLookupKey)(packageKey, band);
        const price = lookupKey
            ? (await this.planPrices()).get(lookupKey)
            : undefined;
        if (!price || !this.priceMatchesPlan(price, packageKey, band)) {
            this.logger.error(`No sellable Stripe price for ${packageKey} at ${band}: expected lookup_key ` +
                `${lookupKey ?? 'none'} at $${(0, pricing_constants_1.monthlyPrice)(packageKey, band)}/month. ` +
                'Run scripts/create-live-stripe-prices.ts.');
            throw new common_1.ServiceUnavailableException(`${pricing_constants_1.PACKAGE_LABELS[packageKey]} can't be bought online right now. Please contact sales.`);
        }
        const metadata = {
            tenantId,
            package: packageKey,
            band,
            modules: pricing_constants_1.PACKAGE_MODULES[packageKey].join(','),
        };
        const existing = await this.liveSubscriptionFor(tenantId);
        if (existing) {
            const [first, ...rest] = existing.items.data;
            await this.stripe().subscriptions.update(existing.id, {
                items: [
                    { id: first.id, price: price.id, quantity: 1 },
                    ...rest.map((item) => ({ id: item.id, deleted: true })),
                ],
                proration_behavior: 'create_prorations',
                metadata,
            });
            return { url: null, changed: true };
        }
        const urls = (0, billing_config_1.billingReturnUrls)();
        const trial = (0, billing_config_1.trialDays)();
        const customer = await this.customerIdFor(tenantId, email);
        const session = await this.stripe().checkout.sessions.create({
            mode: 'subscription',
            customer,
            line_items: [{ price: price.id, quantity: 1 }],
            success_url: urls.success,
            cancel_url: urls.cancel,
            metadata,
            subscription_data: {
                metadata,
                ...(trial ? { trial_period_days: trial } : {}),
            },
        });
        return { url: session.url, changed: false };
    }
    async currentPlanLookupKey(tenantId) {
        const subscription = await this.liveSubscriptionFor(tenantId);
        return subscription?.items.data[0]?.price?.lookup_key ?? null;
    }
    priceMatchesPlan(price, packageKey, band) {
        const amount = (0, pricing_constants_1.monthlyPrice)(packageKey, band);
        return (amount !== null &&
            price.active &&
            price.currency === 'usd' &&
            price.type === 'recurring' &&
            price.recurring?.interval === 'month' &&
            price.recurring?.interval_count === 1 &&
            price.unit_amount === amount * 100);
    }
    async liveSubscriptionFor(tenantId) {
        const record = await this.prisma.tenantSubscription.findUnique({
            where: { tenantId },
            select: { providerSubscriptionId: true },
        });
        if (!record?.providerSubscriptionId)
            return null;
        const subscription = await this.stripe().subscriptions.retrieve(record.providerSubscriptionId);
        const live = [
            'active',
            'trialing',
            'past_due',
            'unpaid',
        ];
        return live.includes(subscription.status) ? subscription : null;
    }
    async createCreditPackCheckoutSession(params) {
        const { tenantId, pack, email } = params;
        const price = (0, credit_packs_constants_1.creditPackPriceId)(pack);
        if (!price) {
            throw new common_1.ServiceUnavailableException(`No price is configured for the ${credit_packs_constants_1.CREDIT_PACKS[pack].label} yet.`);
        }
        await this.assertPriceMatchesPack(price, pack);
        const urls = (0, billing_config_1.billingReturnUrls)();
        const customer = await this.customerIdFor(tenantId, email);
        const session = await this.stripe().checkout.sessions.create({
            mode: 'payment',
            customer,
            line_items: [{ price, quantity: 1 }],
            success_url: urls.creditsSuccess,
            cancel_url: urls.creditsCancel,
            metadata: {
                tenantId,
                creditPack: pack,
                credits: String(credit_packs_constants_1.CREDIT_PACKS[pack].credits),
            },
            payment_intent_data: {
                metadata: { tenantId, creditPack: pack },
            },
        });
        return { url: session.url, sessionId: session.id };
    }
    async assertPriceMatchesPack(priceId, pack) {
        const expected = credit_packs_constants_1.CREDIT_PACKS[pack];
        const price = await this.stripe().prices.retrieve(priceId);
        const matches = price.active &&
            price.type === 'one_time' &&
            price.currency === 'usd' &&
            price.unit_amount === expected.price * 100;
        if (!matches) {
            this.logger.error(`Refusing to sell the ${expected.label}: price ${priceId} charges ` +
                `${price.unit_amount ?? 'unknown'} ${price.currency} (${price.type}, ` +
                `${price.active ? 'active' : 'archived'}), but the pack is ` +
                `$${expected.price} one-time for ${expected.credits} credits. ` +
                `Set ${(0, credit_packs_constants_1.creditPackPriceEnvKey)(pack)} to the matching price.`);
            throw new common_1.ServiceUnavailableException(`The ${expected.label} can't be bought right now. Please try again later.`);
        }
    }
    async checkoutSessionForPaymentIntent(paymentIntentId) {
        const sessions = await this.stripe().checkout.sessions.list({
            payment_intent: paymentIntentId,
            limit: 1,
        });
        return sessions.data[0] ?? null;
    }
    async priceIdsForCheckoutSession(sessionId) {
        const lineItems = await this.stripe().checkout.sessions.listLineItems(sessionId, { limit: 100 });
        return lineItems.data
            .map((item) => item.price?.id)
            .filter((id) => Boolean(id));
    }
    async createPortalSession(tenantId) {
        const subscription = await this.prisma.tenantSubscription.findUnique({
            where: { tenantId },
            select: { providerCustomerId: true },
        });
        if (!subscription?.providerCustomerId) {
            throw new common_1.BadRequestException('This account has no payment record yet. Purchase a service first.');
        }
        const session = await this.stripe().billingPortal.sessions.create({
            customer: subscription.providerCustomerId,
            return_url: (0, billing_config_1.billingReturnUrls)().portalReturn,
        });
        return { url: session.url };
    }
    constructEvent(rawBody, signature) {
        const secret = (0, billing_config_1.stripeWebhookSecret)();
        if (!secret) {
            throw new common_1.ServiceUnavailableException('Webhooks are not configured. Set STRIPE_WEBHOOK_SECRET.');
        }
        try {
            return this.stripe().webhooks.constructEvent(rawBody, signature, secret);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'unknown error';
            this.logger.warn(`Rejected webhook with a bad signature: ${message}`);
            throw new common_1.BadRequestException('Invalid webhook signature.');
        }
    }
    async priceIdsForSubscription(subscriptionId) {
        const subscription = await this.stripe().subscriptions.retrieve(subscriptionId);
        return subscription.items.data
            .map((item) => item.price?.id)
            .filter((id) => Boolean(id));
    }
    async retrieveSubscription(subscriptionId) {
        return this.stripe().subscriptions.retrieve(subscriptionId);
    }
};
exports.StripeService = StripeService;
exports.StripeService = StripeService = StripeService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], StripeService);
//# sourceMappingURL=stripe.service.js.map