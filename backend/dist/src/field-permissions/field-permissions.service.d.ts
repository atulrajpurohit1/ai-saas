import { AuditService } from '../audit/audit.service';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateFieldPermissionsDto } from './dto/update-field-permissions.dto';
import { FieldPermissionEntity, SensitiveFieldDefinition } from './field-permissions.constants';
type EffectiveFieldPermission = SensitiveFieldDefinition & {
    canView: boolean;
    canEdit: boolean;
};
export declare class FieldPermissionsService {
    private readonly prisma;
    private readonly auditService;
    constructor(prisma: PrismaService, auditService: AuditService);
    listFieldDefinitions(): {
        entity: FieldPermissionEntity;
        fields: {
            field: string;
            label: string;
        }[];
    }[];
    listForRole(user: ActiveUser, roleId: string): Promise<{
        roleId: string;
        roleName: string;
        permissions: {
            id: string | null;
            entity: FieldPermissionEntity;
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
            entity: FieldPermissionEntity;
            field: string;
            label: string;
            canView: boolean;
            canEdit: boolean;
        }[];
    }>;
    getEffectivePermissions(user: ActiveUser, entity: string): Promise<EffectiveFieldPermission[]>;
    filterFieldsByPermission<T>(user: ActiveUser, entity: FieldPermissionEntity, data: T): Promise<T>;
    assertCanEditFields(user: ActiveUser, entity: FieldPermissionEntity, data: unknown, entityId?: string): Promise<void>;
    private parseEntity;
    private findTenantRoleOrThrow;
    private deniedFields;
    private resolveEffectivePermissions;
    private resolveUserRoleIds;
    private stripDeniedFields;
    private sensitiveFieldsInPayload;
    private entityId;
}
export {};
