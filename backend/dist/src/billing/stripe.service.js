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
    async createCheckoutSession(params) {
        const { tenantId, modules, interval, email } = params;
        if (!modules.length) {
            throw new common_1.BadRequestException('Select at least one service to purchase.');
        }
        const lineItems = modules.map((module) => {
            const price = (0, billing_config_1.priceIdFor)(module, interval);
            if (!price) {
                throw new common_1.ServiceUnavailableException(`No ${interval} price is configured for ${module} yet.`);
            }
            return { price, quantity: 1 };
        });
        const urls = (0, billing_config_1.billingReturnUrls)();
        const trial = (0, billing_config_1.trialDays)();
        const customer = await this.customerIdFor(tenantId, email);
        const session = await this.stripe().checkout.sessions.create({
            mode: 'subscription',
            customer,
            line_items: lineItems,
            success_url: urls.success,
            cancel_url: urls.cancel,
            metadata: { tenantId, modules: modules.join(',') },
            subscription_data: {
                metadata: { tenantId, modules: modules.join(',') },
                ...(trial ? { trial_period_days: trial } : {}),
            },
        });
        return { url: session.url, sessionId: session.id };
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