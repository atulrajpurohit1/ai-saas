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
var StripeWebhookService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.StripeWebhookService = void 0;
const common_1 = require("@nestjs/common");
const billing_config_1 = require("./billing.config");
const stripe_service_1 = require("./stripe.service");
const subscription_provisioning_service_1 = require("./subscription-provisioning.service");
let StripeWebhookService = StripeWebhookService_1 = class StripeWebhookService {
    stripe;
    provisioning;
    logger = new common_1.Logger(StripeWebhookService_1.name);
    constructor(stripe, provisioning) {
        this.stripe = stripe;
        this.provisioning = provisioning;
    }
    async handle(event) {
        switch (event.type) {
            case 'checkout.session.completed':
                return this.onCheckoutCompleted(event.data.object, event.id);
            case 'customer.subscription.created':
            case 'customer.subscription.updated':
                return this.onSubscriptionChanged(event.data.object, event.id);
            case 'customer.subscription.deleted':
                return this.onSubscriptionDeleted(event.data.object, event.id);
            case 'invoice.payment_failed':
                return this.onPaymentFailed(event.data.object, event.id);
            default:
                this.logger.debug(`Ignoring unhandled Stripe event ${event.type}`);
                return { handled: false, reason: `unhandled:${event.type}` };
        }
    }
    async onCheckoutCompleted(session, eventId) {
        const tenantId = session.metadata?.tenantId;
        const subscriptionId = typeof session.subscription === 'string'
            ? session.subscription
            : session.subscription?.id;
        if (!tenantId || !subscriptionId) {
            this.logger.warn(`checkout.session.completed ${session.id} has no tenantId/subscription; ignoring.`);
            return { handled: false, reason: 'missing-identifiers' };
        }
        const subscription = await this.stripe.retrieveSubscription(subscriptionId);
        return this.applySubscription(tenantId, subscription, eventId);
    }
    async onSubscriptionChanged(subscription, eventId) {
        const tenantId = await this.resolveTenant(subscription);
        if (!tenantId) {
            this.logger.warn(`Subscription ${subscription.id} maps to no known tenant; ignoring.`);
            return { handled: false, reason: 'unknown-tenant' };
        }
        return this.applySubscription(tenantId, subscription, eventId);
    }
    async onSubscriptionDeleted(subscription, eventId) {
        const tenantId = await this.resolveTenant(subscription);
        if (!tenantId)
            return { handled: false, reason: 'unknown-tenant' };
        await this.provisioning.cancel(tenantId, `stripe:${eventId}`);
        return { handled: true, tenantId };
    }
    async onPaymentFailed(invoice, eventId) {
        const customerId = typeof invoice.customer === 'string'
            ? invoice.customer
            : invoice.customer?.id;
        const tenantId = await this.provisioning.tenantForProviderIds({ customerId });
        if (!tenantId)
            return { handled: false, reason: 'unknown-tenant' };
        await this.provisioning.setStatus(tenantId, 'PAST_DUE', `stripe:${eventId}`);
        return { handled: true, tenantId };
    }
    async applySubscription(tenantId, subscription, eventId) {
        const modules = this.modulesFor(subscription);
        if (!modules.length) {
            this.logger.error(`Subscription ${subscription.id} has no recognised price ids; refusing to provision. ` +
                'Check the STRIPE_PRICE_* env vars match the Dashboard.');
            return { handled: false, reason: 'no-known-prices' };
        }
        await this.provisioning.provision({
            tenantId,
            modules,
            status: this.statusFor(subscription.status),
            trialEndsAt: toDate(subscription.trial_end),
            currentPeriodEnd: currentPeriodEnd(subscription),
            cancelAtPeriodEnd: subscription.cancel_at_period_end ?? false,
            providerCustomerId: typeof subscription.customer === 'string'
                ? subscription.customer
                : subscription.customer?.id,
            providerSubscriptionId: subscription.id,
            reason: `stripe:${eventId}`,
        });
        return { handled: true, tenantId, modules };
    }
    modulesFor(subscription) {
        const fromPrices = subscription.items.data
            .map((item) => item.price?.id)
            .filter((id) => Boolean(id))
            .map(billing_config_1.moduleForPriceId)
            .filter((module) => module !== null);
        return [...new Set(fromPrices)];
    }
    statusFor(status) {
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
                return 'CANCELED';
        }
    }
    async resolveTenant(subscription) {
        const fromMetadata = subscription.metadata?.tenantId;
        if (fromMetadata)
            return fromMetadata;
        return this.provisioning.tenantForProviderIds({
            subscriptionId: subscription.id,
            customerId: typeof subscription.customer === 'string'
                ? subscription.customer
                : subscription.customer?.id,
        });
    }
};
exports.StripeWebhookService = StripeWebhookService;
exports.StripeWebhookService = StripeWebhookService = StripeWebhookService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [stripe_service_1.StripeService,
        subscription_provisioning_service_1.SubscriptionProvisioningService])
], StripeWebhookService);
function toDate(seconds) {
    return seconds ? new Date(seconds * 1000) : null;
}
function currentPeriodEnd(subscription) {
    const top = subscription
        .current_period_end;
    if (top)
        return toDate(top);
    const fromItems = subscription.items?.data
        ?.map((item) => item.current_period_end)
        .filter((value) => typeof value === 'number');
    return fromItems?.length ? toDate(Math.max(...fromItems)) : null;
}
//# sourceMappingURL=stripe-webhook.service.js.map