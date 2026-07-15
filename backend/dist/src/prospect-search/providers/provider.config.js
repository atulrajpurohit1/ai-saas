"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ACTIVE_COMPANY_PROVIDERS = exports.SUPPORTED_COMPANY_PROVIDERS = void 0;
exports.resolveCompanyProviderName = resolveCompanyProviderName;
exports.SUPPORTED_COMPANY_PROVIDERS = [
    'apollo',
    'crunchbase',
    'clearbit',
];
exports.ACTIVE_COMPANY_PROVIDERS = ['apollo'];
function resolveCompanyProviderName(rawValue) {
    const normalized = (rawValue || 'apollo').trim().toLowerCase();
    if (!exports.SUPPORTED_COMPANY_PROVIDERS.includes(normalized)) {
        throw new Error(`Invalid COMPANY_PROVIDER "${rawValue}". Supported values: ${exports.SUPPORTED_COMPANY_PROVIDERS.join(', ')}.`);
    }
    return normalized;
}
//# sourceMappingURL=provider.config.js.map