"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CREDIT_PACK_KEYS = exports.CREDIT_PACKS = void 0;
exports.isCreditPackKey = isCreditPackKey;
exports.playbookCreditCost = playbookCreditCost;
exports.discoveryCreditCost = discoveryCreditCost;
exports.creditPackPriceEnvKey = creditPackPriceEnvKey;
exports.creditPackPriceId = creditPackPriceId;
exports.creditPackForPriceId = creditPackForPriceId;
exports.sellableCreditPacks = sellableCreditPacks;
exports.CREDIT_PACKS = {
    STARTER: { key: 'STARTER', label: 'Starter Pack', credits: 3000, price: 149 },
    PRO: { key: 'PRO', label: 'Pro Pack', credits: 13000, price: 249 },
    ELITE: { key: 'ELITE', label: 'Elite Pack', credits: 23000, price: 349 },
};
exports.CREDIT_PACK_KEYS = Object.keys(exports.CREDIT_PACKS);
function isCreditPackKey(value) {
    return Object.prototype.hasOwnProperty.call(exports.CREDIT_PACKS, value);
}
const DEFAULT_PLAYBOOK_CREDIT_COST = 50;
const DEFAULT_DISCOVERY_CREDIT_COST = 200;
function creditCostFromEnv(key, fallback) {
    const configured = Number(process.env[key]);
    return Number.isInteger(configured) && configured > 0 ? configured : fallback;
}
function playbookCreditCost() {
    return creditCostFromEnv('PROSPECT_PLAYBOOK_CREDIT_COST', DEFAULT_PLAYBOOK_CREDIT_COST);
}
function discoveryCreditCost() {
    return creditCostFromEnv('PROSPECT_DISCOVERY_CREDIT_COST', DEFAULT_DISCOVERY_CREDIT_COST);
}
function creditPackPriceEnvKey(pack) {
    return `STRIPE_PRICE_CREDITS_${pack}`;
}
function creditPackPriceId(pack) {
    return process.env[creditPackPriceEnvKey(pack)]?.trim() || null;
}
function creditPackForPriceId(priceId) {
    for (const pack of exports.CREDIT_PACK_KEYS) {
        if (creditPackPriceId(pack) === priceId)
            return exports.CREDIT_PACKS[pack];
    }
    return null;
}
function sellableCreditPacks() {
    return exports.CREDIT_PACK_KEYS.map((key) => exports.CREDIT_PACKS[key]).filter((pack) => creditPackPriceId(pack.key));
}
//# sourceMappingURL=credit-packs.constants.js.map