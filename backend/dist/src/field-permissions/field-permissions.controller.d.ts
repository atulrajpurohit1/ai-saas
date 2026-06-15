import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { UpdateFieldPermissionsDto } from './dto/update-field-permissions.dto';
import { FieldPermissionsService } from './field-permissions.service';
export declare class FieldPermissionsController {
    private readonly fieldPermissionsService;
    constructor(fieldPermissionsService: FieldPermissionsService);
    listFieldDefinitions(): {
        entity: import("./field-permissions.constants").FieldPermissionEntity;
        fields: {
            field: string;
            label: string;
        }[];
    }[];
    getEffectivePermissions(user: ActiveUser, entity: string): Promise<(import("./field-permissions.constants").SensitiveFieldDefinition & {
        canView: boolean;
        canEdit: boolean;
    })[]>;
    listForRole(user: ActiveUser, roleId: string): Promise<{
        roleId: string;
        roleName: string;
        permissions: {
            id: string | null;
            entity: import("./field-permissions.constants").FieldPermissionEntity;
            field: string;
            label: string;
            canView: boolean;
            canEdit: boolean;
        }[];
    }>;
    updateRolePermissions(user: ActiveUser, roleId: string, dto: UpdateFieldPermissionsDto): Promise<{
        roleId: string;
        roleName: string;
        permissions: {
            id: string | null;
            entity: import("./field-permissions.constants").FieldPermissionEntity;
            field: string;
            label: string;
            canView: boolean;
            canEdit: boolean;
        }[];
    }>;
}
