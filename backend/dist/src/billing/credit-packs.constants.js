"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PLAYBOOK_CREDIT_COST = exports.CREDIT_PACK_KEYS = exports.CREDIT_PACKS = void 0;
exports.isCreditPackKey = isCreditPackKey;
exports.creditPackPriceEnvKey = creditPackPriceEnvKey;
exports.creditPackPriceId = creditPackPriceId;
exports.creditPackForPriceId = creditPackForPriceId;
exports.sellableCreditPacks = sellableCreditPacks;
exports.CREDIT_PACKS = {
    STARTER: { key: 'STARTER', label: 'Starter Pack', credits: 250, price: 99 },
    GROWTH: { key: 'GROWTH', label: 'Growth Pack', credits: 1000, price: 299 },
    SCALE: { key: 'SCALE', label: 'Scale Pack', credits: 5000, price: 1199 },
};
exports.CREDIT_PACK_KEYS = Object.keys(exports.CREDIT_PACKS);
function isCreditPackKey(value) {
    return Object.prototype.hasOwnProperty.call(exports.CREDIT_PACKS, value);
}
exports.PLAYBOOK_CREDIT_COST = 1;
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