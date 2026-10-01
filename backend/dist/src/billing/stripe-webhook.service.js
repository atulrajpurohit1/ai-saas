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
const credit_packs_constants_1 = require("./credit-packs.constants");
const credits_service_1 = require("./credits.service");
const stripe_service_1 = require("./stripe.service");
const subscription_provisioning_service_1 = require("./subscription-provisioning.service");
let StripeWebhookService = StripeWebhookService_1 = class StripeWebhookService {
    stripe;
    provisioning;
    credits;
    logger = new common_1.Logger(StripeWebhookService_1.name);
    constructor(stripe, provisioning, credits) {
        this.stripe = stripe;
        this.provisioning = provisioning;
        this.credits = credits;
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
            case 'charge.refunded':
                return this.onChargeRefunded(event.data.object);
            case 'charge.dispute.created':
                return this.onChargeDisputed(event.data.object);
            default:
                this.logger.debug(`Ignoring unhandled Stripe event ${event.type}`);
                return { handled: false, reason: `unhandled:${event.type}` };
        }
    }
    async onCheckoutCompleted(session, eventId) {
        const tenantId = session.metadata?.tenantId;
        if (session.mode === 'payment') {
            return this.onCreditPackPurchased(session);
        }
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
    async onCreditPackPurchased(session) {
        const tenantId = session.metadata?.tenantId;
        if (!tenantId) {
            this.logger.warn(`Credit pack checkout ${session.id} carries no tenantId; ignoring.`);
            return { handled: false, reason: 'missing-tenant' };
        }
        if (session.payment_status !== 'paid') {
            this.logger.log(`Credit pack checkout ${session.id} is ${session.payment_status}, not paid; no credits granted.`);
            return { handled: false, reason: 'unpaid' };
        }
        const priceIds = await this.stripe.priceIdsForCheckoutSession(session.id);
        const pack = priceIds
            .map((priceId) => (0, credit_packs_constants_1.creditPackForPriceId)(priceId))
            .find((candidate) => candidate !== null);
        if (!pack) {
            this.logger.error(`Credit pack checkout ${session.id} has no price id matching a configured pack (saw: ${priceIds.join(', ') || 'none'}); no credits granted.`);
            return { handled: false, reason: 'unknown-pack' };
        }
        const result = await this.credits.grant({
            tenantId,
            amount: pack.credits,
            description: `${pack.label}: ${pack.credits} Prospect Search credits.`,
            stripeSessionId: session.id,
        });
        this.logger.log(result.granted
            ? `Granted ${pack.credits} credits to tenant ${tenantId} from ${session.id}; balance is now ${result.balance}.`
            : `Credit pack ${session.id} was already applied for tenant ${tenantId}; balance unchanged at ${result.balance}.`);
        return { handled: true, tenantId, credits: pack.credits };
    }
    async onChargeRefunded(charge) {
        const paymentIntentId = typeof charge.payment_intent === 'string'
            ? charge.payment_intent
            : charge.payment_intent?.id;
        if (!paymentIntentId) {
            return { handled: false, reason: 'no-payment-intent' };
        }
        if (charge.amount_refunded < charge.amount) {
            this.logger.warn(`Charge ${charge.id} was partially refunded (${charge.amount_refunded} of ${charge.amount}); credits NOT reversed automatically. Adjust by hand if this was a credit pack.`);
            return { handled: false, reason: 'partial-refund' };
        }
        return this.reverseCreditsForPaymentIntent(paymentIntentId, 'Credit pack refunded; credits reversed.');
    }
    async onChargeDisputed(dispute) {
        const paymentIntentId = typeof dispute.payment_intent === 'string'
            ? dispute.payment_intent
            : dispute.payment_intent?.id;
        if (!paymentIntentId) {
            return { handled: false, reason: 'no-payment-intent' };
        }
        return this.reverseCreditsForPaymentIntent(paymentIntentId, 'Credit pack payment disputed; credits reversed.');
    }
    async reverseCreditsForPaymentIntent(paymentIntentId, reason) {
        const session = await this.stripe.checkoutSessionForPaymentIntent(paymentIntentId);
        if (!session || session.mode !== 'payment') {
            return { handled: false, reason: 'not-a-credit-purchase' };
        }
        const tenantId = session.metadata?.tenantId;
        if (!tenantId) {
            this.logger.warn(`Refunded session ${session.id} carries no tenantId; cannot reverse credits.`);
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
        subscription_provisioning_service_1.SubscriptionProvisioningService,
        credits_service_1.CreditsService])
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