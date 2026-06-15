import { FieldPermissionEntity } from '../field-permissions.constants';
export declare class FieldPermissionInputDto {
    entity: FieldPermissionEntity;
    field: string;
    can_view: boolean;
    can_edit: boolean;
}
export declare class UpdateFieldPermissionsDto {
    permissions: FieldPermissionInputDto[];
}
