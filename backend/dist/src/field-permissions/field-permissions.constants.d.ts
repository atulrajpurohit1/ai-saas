export type FieldPermissionEntity = 'guard' | 'client' | 'invoice';
export type FieldPermissionAction = 'view' | 'edit';
export interface SensitiveFieldDefinition {
    entity: FieldPermissionEntity;
    field: string;
    label: string;
    aliases: string[];
}
export declare const SENSITIVE_FIELD_DEFINITIONS: Record<FieldPermissionEntity, SensitiveFieldDefinition[]>;
export declare const FIELD_PERMISSION_ENTITIES: FieldPermissionEntity[];
export declare function getSensitiveFields(entity: FieldPermissionEntity): SensitiveFieldDefinition[];
export declare function isFieldPermissionEntity(value: string): value is FieldPermissionEntity;
export declare function isSensitiveField(entity: FieldPermissionEntity, field: string): boolean;
