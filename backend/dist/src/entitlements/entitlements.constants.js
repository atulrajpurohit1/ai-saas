"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CORE_PERMISSION_MODULES = exports.PERMISSION_MODULE_TO_SERVICE = exports.SERVICE_MODULE_LABELS = exports.SERVICE_MODULES = void 0;
exports.serviceForPermissionModule = serviceForPermissionModule;
exports.isServiceModule = isServiceModule;
exports.SERVICE_MODULES = [
    'LEAD_GEN',
    'GUARD_TOUR',
    'FINANCE',
];
exports.SERVICE_MODULE_LABELS = {
    LEAD_GEN: 'AegisLead Generation',
    GUARD_TOUR: 'AegisLead Guard',
    FINANCE: 'AegisLead Operations',
};
exports.PERMISSION_MODULE_TO_SERVICE = {
    leads: 'LEAD_GEN',
    deals: 'LEAD_GEN',
    proposals: 'LEAD_GEN',
    prospect_search: 'LEAD_GEN',
    rfp: 'LEAD_GEN',
    vendors: 'LEAD_GEN',
    guards: 'GUARD_TOUR',
    patrols: 'GUARD_TOUR',
    incidents: 'GUARD_TOUR',
    reports: 'GUARD_TOUR',
    shifts: 'FINANCE',
    timesheets: 'FINANCE',
    invoices: 'FINANCE',
    invoice_disputes: 'FINANCE',
    finance: 'FINANCE',
    rate_cards: 'FINANCE',
};
exports.CORE_PERMISSION_MODULES = [
    'dashboard',
    'identity',
    'settings',
    'billing',
    'audit',
    'integrations',
    'branches',
    'clients',
    'sites',
    'documents',
    'notes',
    'activities',
    'ai',
];
function serviceForPermissionModule(permissionModule) {
    return exports.PERMISSION_MODULE_TO_SERVICE[permissionModule] ?? null;
}
function isServiceModule(value) {
    return exports.SERVICE_MODULES.includes(value);
}
//# sourceMappingURL=entitlements.constants.js.map