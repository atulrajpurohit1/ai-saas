"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeApolloOrganization = normalizeApolloOrganization;
exports.normalizeCrunchbaseOrganization = normalizeCrunchbaseOrganization;
exports.normalizeClearbitCompany = normalizeClearbitCompany;
function normalizeApolloOrganization(raw) {
    return {
        id: raw.id,
        name: raw.name,
        industry: raw.industry || 'Unknown',
        website: raw.website_url || '',
        city: raw.city || '',
        state: raw.state || '',
        country: raw.country || '',
        employeeCount: raw.estimated_num_employees ?? 0,
        revenueRange: raw.annual_revenue_range || 'Unknown',
        description: raw.short_description || '',
    };
}
function normalizeCrunchbaseOrganization(raw) {
    return {
        id: raw.uuid,
        name: raw.properties.name,
        industry: raw.properties.categories?.[0] || 'Unknown',
        website: raw.properties.website?.value || '',
        city: raw.properties.city_name || '',
        state: raw.properties.region_name || '',
        country: raw.properties.country_code || '',
        employeeCount: parseEmployeeEnum(raw.properties.num_employees_enum),
        revenueRange: raw.properties.revenue_range || 'Unknown',
        description: raw.properties.short_description || '',
    };
}
function normalizeClearbitCompany(raw) {
    return {
        id: raw.id,
        name: raw.name,
        industry: raw.category?.industry || 'Unknown',
        website: raw.domain ? `https://${raw.domain}` : '',
        city: raw.geo?.city || '',
        state: raw.geo?.state || '',
        country: raw.geo?.country || '',
        employeeCount: raw.metrics?.employees ?? 0,
        revenueRange: raw.metrics?.estimatedAnnualRevenue || 'Unknown',
        description: raw.description || '',
    };
}
function parseEmployeeEnum(value) {
    if (!value)
        return 0;
    const match = value.match(/(\d+)_(\d+)/);
    if (!match)
        return 0;
    const low = Number(match[1]);
    const high = Number(match[2]);
    if (!Number.isFinite(low) || !Number.isFinite(high))
        return 0;
    return Math.round((low + high) / 2);
}
//# sourceMappingURL=company-normalizer.js.map