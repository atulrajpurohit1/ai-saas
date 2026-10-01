"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PACKAGE_KEYS = exports.GENERATION_ONLY_BAND = exports.MONTHLY_PRICES = exports.PACKAGE_MODULES = exports.PACKAGE_LABELS = exports.GUARD_BANDS = void 0;
exports.bandForGuardCount = bandForGuardCount;
exports.packageForModules = packageForModules;
exports.billableBand = billableBand;
exports.monthlyPrice = monthlyPrice;
exports.isCustomQuote = isCustomQuote;
exports.bandRank = bandRank;
exports.isGuardBand = isGuardBand;
exports.isPackageKey = isPackageKey;
exports.planLookupKey = planLookupKey;
exports.allPlanLookupKeys = allPlanLookupKeys;
exports.planForLookupKey = planForLookupKey;
exports.GUARD_BANDS = [
    { key: '1-25', min: 0, max: 25 },
    { key: '26-50', min: 26, max: 50 },
    { key: '51-100', min: 51, max: 100 },
    { key: '101-250', min: 101, max: 250 },
    { key: '251-500', min: 251, max: 500 },
    { key: '500+', min: 501, max: null },
];
exports.PACKAGE_LABELS = {
    GENERATION: 'AegisLead Generation',
    GUARD: 'AegisLead Guard',
    OPERATIONS: 'AegisLead Operations',
    COMPLETE: 'AegisLead Complete',
};
exports.PACKAGE_MODULES = {
    GENERATION: ['LEAD_GEN'],
    GUARD: ['GUARD_TOUR'],
    OPERATIONS: ['FINANCE'],
    COMPLETE: ['LEAD_GEN', 'GUARD_TOUR', 'FINANCE'],
};
exports.MONTHLY_PRICES = {
    GENERATION: {
        '1-25': 299,
        '26-50': 399,
        '51-100': 499,
        '101-250': 699,
        '251-500': 899,
        '500+': null,
    },
    GUARD: {
        '1-25': 99,
        '26-50': 149,
        '51-100': 249,
        '101-250': 399,
        '251-500': 599,
        '500+': null,
    },
    OPERATIONS: {
        '1-25': 199,
        '26-50': 299,
        '51-100': 449,
        '101-250': 699,
        '251-500': 999,
        '500+': null,
    },
    COMPLETE: {
        '1-25': 499,
        '26-50': 649,
        '51-100': 849,
        '101-250': 1199,
        '251-500': 1699,
        '500+': null,
    },
};
exports.GENERATION_ONLY_BAND = '1-25';
function bandForGuardCount(count) {
    const band = exports.GUARD_BANDS.find((entry) => count >= entry.min && (entry.max === null || count <= entry.max));
    return band?.key ?? '500+';
}
function packageForModules(modules) {
    const wanted = [...new Set(modules)].sort().join(',');
    for (const [key, included] of Object.entries(exports.PACKAGE_MODULES)) {
        if ([...included].sort().join(',') === wanted)
            return key;
    }
    return null;
}
function billableBand(packageKey, activeGuards) {
    if (packageKey === 'GENERATION')
        return exports.GENERATION_ONLY_BAND;
    return bandForGuardCount(activeGuards);
}
function monthlyPrice(packageKey, band) {
    return exports.MONTHLY_PRICES[packageKey][band];
}
function isCustomQuote(band) {
    return band === '500+';
}
exports.PACKAGE_KEYS = Object.keys(exports.PACKAGE_LABELS);
function bandRank(band) {
    return exports.GUARD_BANDS.findIndex((entry) => entry.key === band);
}
function isGuardBand(value) {
    return exports.GUARD_BANDS.some((entry) => entry.key === value);
}
function isPackageKey(value) {
    return Object.prototype.hasOwnProperty.call(exports.PACKAGE_LABELS, value);
}
function planLookupKey(packageKey, band) {
    const price = monthlyPrice(packageKey, band);
    if (price === null)
        return null;
    const bandSlug = band.replace('+', '_plus').replace('-', '_');
    return `aegislead_${packageKey.toLowerCase()}_${bandSlug}_${price}usd_monthly`;
}
function allPlanLookupKeys() {
    return exports.PACKAGE_KEYS.flatMap((packageKey) => exports.GUARD_BANDS.map((band) => planLookupKey(packageKey, band.key))).filter((key) => key !== null);
}
function planForLookupKey(lookupKey) {
    if (!lookupKey)
        return null;
    for (const packageKey of exports.PACKAGE_KEYS) {
        for (const band of exports.GUARD_BANDS) {
            if (planLookupKey(packageKey, band.key) === lookupKey) {
                return { packageKey, band: band.key };
            }
        }
    }
    return null;
}
//# sourceMappingURL=pricing.constants.js.map