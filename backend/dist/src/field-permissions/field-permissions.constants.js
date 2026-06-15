"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FIELD_PERMISSION_ENTITIES = exports.SENSITIVE_FIELD_DEFINITIONS = void 0;
exports.getSensitiveFields = getSensitiveFields;
exports.isFieldPermissionEntity = isFieldPermissionEntity;
exports.isSensitiveField = isSensitiveField;
exports.SENSITIVE_FIELD_DEFINITIONS = {
    guard: [
        {
            entity: 'guard',
            field: 'salary',
            label: 'Salary',
            aliases: ['salary'],
        },
        {
            entity: 'guard',
            field: 'bank_details',
            label: 'Bank details',
            aliases: ['bankDetails', 'bank_details'],
        },
        {
            entity: 'guard',
            field: 'documents',
            label: 'Documents',
            aliases: ['documents'],
        },
        {
            entity: 'guard',
            field: 'personal_notes',
            label: 'Personal notes',
            aliases: ['personalNotes', 'personal_notes'],
        },
    ],
    client: [
        {
            entity: 'client',
            field: 'billing_notes',
            label: 'Billing notes',
            aliases: ['billingNotes', 'billing_notes'],
        },
        {
            entity: 'client',
            field: 'internal_notes',
            label: 'Internal notes',
            aliases: ['internalNotes', 'internal_notes'],
        },
    ],
    invoice: [
        {
            entity: 'invoice',
            field: 'internal_adjustments',
            label: 'Internal adjustments',
            aliases: ['internalAdjustments', 'internal_adjustments'],
        },
    ],
};
exports.FIELD_PERMISSION_ENTITIES = Object.keys(exports.SENSITIVE_FIELD_DEFINITIONS);
function getSensitiveFields(entity) {
    return exports.SENSITIVE_FIELD_DEFINITIONS[entity] || [];
}
function isFieldPermissionEntity(value) {
    return exports.FIELD_PERMISSION_ENTITIES.includes(value);
}
function isSensitiveField(entity, field) {
    return getSensitiveFields(entity).some((definition) => definition.field === field);
}
//# sourceMappingURL=field-permissions.constants.js.map