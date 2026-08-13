"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CRM_PROVIDERS = exports.CrmApiError = void 0;
class CrmApiError extends Error {
    status;
    constructor(status, message) {
        super(message);
        this.status = status;
        this.name = 'CrmApiError';
    }
}
exports.CrmApiError = CrmApiError;
exports.CRM_PROVIDERS = Symbol('CRM_PROVIDERS');
//# sourceMappingURL=crm-provider.interface.js.map