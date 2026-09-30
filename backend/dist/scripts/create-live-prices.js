"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const stripe_1 = __importDefault(require("stripe"));
const dotenv = __importStar(require("dotenv"));
const credit_packs_constants_1 = require("../src/billing/credit-packs.constants");
const pricing_constants_1 = require("../src/billing/pricing.constants");
dotenv.config();
const key = process.env.STRIPE_SECRET_KEY ?? '';
if (!key.startsWith('sk_test_')) {
    console.error('Refusing to run: STRIPE_SECRET_KEY is not a test key.');
    process.exit(1);
}
const stripe = new stripe_1.default(key);
async function findOrCreatePrice(params) {
    const { productName, lookupKey, amount, recurring, metadata } = params;
    const existing = await stripe.prices.list({ lookup_keys: [lookupKey], limit: 1 });
    if (existing.data[0]) {
        return { id: existing.data[0].id, created: false };
    }
    const product = await stripe.products.create({ name: productName, metadata });
    const price = await stripe.prices.create({
        product: product.id,
        unit_amount: amount * 100,
        currency: 'usd',
        lookup_key: lookupKey,
        ...(recurring ? { recurring: { interval: recurring } } : {}),
        metadata,
    });
    return { id: price.id, created: true };
}
(async () => {
    const lines = [];
    console.log('--- Credit packs (one-time) ---');
    for (const packKey of credit_packs_constants_1.CREDIT_PACK_KEYS) {
        const pack = credit_packs_constants_1.CREDIT_PACKS[packKey];
        const result = await findOrCreatePrice({
            productName: `AegisLead ${pack.label} (${pack.credits} Prospect Search credits)`,
            lookupKey: `credits_${packKey.toLowerCase()}`,
            amount: pack.price,
            recurring: null,
            metadata: { creditPack: packKey, credits: String(pack.credits) },
        });
        console.log(`  ${pack.label}: $${pack.price} / ${pack.credits} credits -> ${result.id} ${result.created ? '(created)' : '(existing)'}`);
        lines.push(`STRIPE_PRICE_CREDITS_${packKey}=${result.id}`);
    }
    const SERVICES = [
        { env: 'LEAD_GEN', label: 'AegisLead Generation', monthly: pricing_constants_1.MONTHLY_PRICES.GENERATION[pricing_constants_1.GENERATION_ONLY_BAND] },
        { env: 'GUARD_TOUR', label: 'AegisLead Guard', monthly: pricing_constants_1.MONTHLY_PRICES.GUARD['1-25'] },
        { env: 'FINANCE', label: 'AegisLead Operations', monthly: pricing_constants_1.MONTHLY_PRICES.OPERATIONS['1-25'] },
    ];
    console.log('\n--- Subscriptions (monthly + annual) ---');
    for (const service of SERVICES) {
        const monthly = await findOrCreatePrice({
            productName: `${service.label} (monthly)`,
            lookupKey: `${service.env.toLowerCase()}_monthly`,
            amount: service.monthly,
            recurring: 'month',
            metadata: { module: service.env, interval: 'monthly' },
        });
        const annualAmount = service.monthly * 10;
        const annual = await findOrCreatePrice({
            productName: `${service.label} (annual)`,
            lookupKey: `${service.env.toLowerCase()}_annual`,
            amount: annualAmount,
            recurring: 'year',
            metadata: { module: service.env, interval: 'annual' },
        });
        console.log(`  ${service.label}: $${service.monthly}/mo -> ${monthly.id} ${monthly.created ? '(created)' : '(existing)'}`);
        console.log(`  ${service.label}: $${annualAmount}/yr -> ${annual.id} ${annual.created ? '(created)' : '(existing)'}`);
        lines.push(`STRIPE_PRICE_${service.env}_MONTHLY=${monthly.id}`);
        lines.push(`STRIPE_PRICE_${service.env}_ANNUAL=${annual.id}`);
    }
    console.log('\n--- env lines ---');
    lines.forEach((line) => console.log(line));
})().catch((e) => { console.error('FAIL:', e.message); process.exit(1); });
//# sourceMappingURL=create-live-prices.js.map