"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.priceIdFor = priceIdFor;
exports.moduleForPriceId = moduleForPriceId;
exports.stripeSecretKey = stripeSecretKey;
exports.stripeWebhookSecret = stripeWebhookSecret;
exports.billingReturnUrls = billingReturnUrls;
exports.trialDays = trialDays;
exports.isCheckoutConfigured = isCheckoutConfigured;
exports.sellableModules = sellableModules;
const ENV_KEYS = {
    LEAD_GEN: {
        monthly: 'STRIPE_PRICE_LEAD_GEN_MONTHLY',
        annual: 'STRIPE_PRICE_LEAD_GEN_ANNUAL',
    },
    GUARD_TOUR: {
        monthly: 'STRIPE_PRICE_GUARD_TOUR_MONTHLY',
        annual: 'STRIPE_PRICE_GUARD_TOUR_ANNUAL',
    },
    FINANCE: {
        monthly: 'STRIPE_PRICE_FINANCE_MONTHLY',
        annual: 'STRIPE_PRICE_FINANCE_ANNUAL',
    },
};
function priceIdFor(module, interval) {
    return process.env[ENV_KEYS[module][interval]]?.trim() || null;
}
function moduleForPriceId(priceId) {
    for (const [module, intervals] of Object.entries(ENV_KEYS)) {
        for (const envKey of Object.values(intervals)) {
            if (process.env[envKey]?.trim() === priceId) {
                return module;
            }
        }
    }
    return null;
}
function stripeSecretKey() {
    return process.env.STRIPE_SECRET_KEY?.trim() || null;
}
function stripeWebhookSecret() {
    return process.env.STRIPE_WEBHOOK_SECRET?.trim() || null;
}
function billingReturnUrls() {
    const configured = process.env.BILLING_RETURN_URL || process.env.FRONTEND_URL;
    if (!configured && process.env.NODE_ENV === 'production') {
        console.error('BILLING_RETURN_URL is not set. Stripe will return paying customers to ' +
            'http://localhost:3000, which is their own machine. Set it to the origin ' +
            'customers sign in on.');
    }
    const base = (configured || 'http://localhost:3000').replace(/\/+$/, '');
    return {
        success: `${base}/settings/plan?checkout=success`,
        cancel: `${base}/settings/plan?checkout=cancelled`,
        portalReturn: `${base}/settings/plan`,
        creditsSuccess: `${base}/settings/credits?checkout=success`,
        creditsCancel: `${base}/settings/credits?checkout=cancelled`,
    };
}
function trialDays() {
    const raw = process.env.STRIPE_TRIAL_DAYS?.trim();
    if (!raw)
        return null;
    const days = Number.parseInt(raw, 10);
    return Number.isFinite(days) && days > 0 ? days : null;
}
function isCheckoutConfigured() {
    return Boolean(stripeSecretKey());
}
function sellableModules(interval = 'monthly') {
    return Object.keys(ENV_KEYS).filter((module) => priceIdFor(module, interval));
}
//# sourceMappingURL=billing.config.js.map