export type FieldPermissionEntity = 'guard' | 'client' | 'invoice';

export type FieldPermissionAction = 'view' | 'edit';

export interface SensitiveFieldDefinition {
  entity: FieldPermissionEntity;
  field: string;
  label: string;
  aliases: string[];
}

export const SENSITIVE_FIELD_DEFINITIONS: Record<
  FieldPermissionEntity,
  SensitiveFieldDefinition[]
> = {
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

export const FIELD_PERMISSION_ENTITIES = Object.keys(
  SENSITIVE_FIELD_DEFINITIONS,
) as FieldPermissionEntity[];

export function getSensitiveFields(entity: FieldPermissionEntity) {
  return SENSITIVE_FIELD_DEFINITIONS[entity] || [];
}

export function isFieldPermissionEntity(
  value: string,
): value is FieldPermissionEntity {
  return FIELD_PERMISSION_ENTITIES.includes(value as FieldPermissionEntity);
}

export function isSensitiveField(entity: FieldPermissionEntity, field: string) {
  return getSensitiveFields(entity).some((definition) => definition.field === field);
}
