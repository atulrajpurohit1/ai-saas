import { AuditService } from '../audit/audit.service';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import { AssignUserRoleDto } from './dto/assign-user-role.dto';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
export declare class RolesService {
    private readonly prisma;
    private readonly auditService;
    private permissionsReady;
    private readonly tenantSystemRolesReady;
    constructor(prisma: PrismaService, auditService: AuditService);
    ensurePermissions(): Promise<void>;
    ensureTenantSystemRoles(tenantId: string): Promise<void>;
    ensureDefaultAssignmentForUser(userId: string): Promise<void>;
    getUserAccessProfile(userId: string): Promise<{
        id: string;
        email: string;
        name: string | null;
        role: string;
        tenantId: string;
        tenantName: string;
        branchId: string | null;
        branch: {
            id: string;
            name: string;
        } | null;
        isSuperAdmin: boolean;
        roles: {
            assignmentId: string;
            id: string;
            name: string;
            description: string | null;
            isSystemRole: boolean;
            branchId: string | null;
            branch: {
                id: string;
                name: string;
            } | null;
        }[];
        permissions: string[];
    }>;
    listPermissions(): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        description: string | null;
        key: string;
        module: string;
    }[]>;
    listRoles(user: ActiveUser): Promise<{
        id: any;
        tenantId: any;
        name: any;
        description: any;
        isSystemRole: any;
        isActive: any;
        createdAt: any;
        updatedAt: any;
        assignmentCount: any;
        permissions: any;
    }[]>;
    createRole(user: ActiveUser, dto: CreateRoleDto): Promise<{
        id: any;
        tenantId: any;
        name: any;
        description: any;
        isSystemRole: any;
        isActive: any;
        createdAt: any;
        updatedAt: any;
        assignmentCount: any;
        permissions: any;
    }>;
    updateRole(user: ActiveUser, id: string, dto: UpdateRoleDto): Promise<{
        id: any;
        tenantId: any;
        name: any;
        description: any;
        isSystemRole: any;
        isActive: any;
        createdAt: any;
        updatedAt: any;
        assignmentCount: any;
        permissions: any;
    }>;
    deactivateRole(user: ActiveUser, id: string): Promise<{
        id: any;
        tenantId: any;
        name: any;
        description: any;
        isSystemRole: any;
        isActive: any;
        createdAt: any;
        updatedAt: any;
        assignmentCount: any;
        permissions: any;
    }>;
    listUsers(user: ActiveUser): Promise<{
        id: string;
        name: string | null;
        email: string;
        role: import(".prisma/client").$Enums.UserRole;
        branchId: string | null;
        isSuperAdmin: boolean;
        branch: {
            id: string;
            name: string;
        } | null;
        roleAssignments: ({
            role: {
                id: string;
                name: string;
                createdAt: Date;
                updatedAt: Date;
                tenantId: string;
                description: string | null;
                isSystemRole: boolean;
                isActive: boolean;
            };
            branch: {
                id: string;
                name: string;
            } | null;
        } & {
            id: string;
            tenantId: string;
            branchId: string | null;
            userId: string;
            isActive: boolean;
            roleId: string;
            assignedAt: Date;
            assignedBy: string | null;
            revokedAt: Date | null;
        })[];
    }[]>;
    assignRole(user: ActiveUser, dto: AssignUserRoleDto): Promise<{
        role: {
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            tenantId: string;
            description: string | null;
            isSystemRole: boolean;
            isActive: boolean;
        };
        branch: {
            id: string;
            name: string;
        } | null;
    } & {
        id: string;
        tenantId: string;
        branchId: string | null;
        userId: string;
        isActive: boolean;
        roleId: string;
        assignedAt: Date;
        assignedBy: string | null;
        revokedAt: Date | null;
    }>;
    revokeAssignment(user: ActiveUser, assignmentId: string): Promise<{
        id: string;
        tenantId: string;
        branchId: string | null;
        userId: string;
        isActive: boolean;
        roleId: string;
        assignedAt: Date;
        assignedBy: string | null;
        revokedAt: Date | null;
    }>;
    hasPermissions(user: ActiveUser | undefined, required: string[]): Promise<boolean>;
    hasAnyPermission(user: ActiveUser | undefined, permissions: string[]): Promise<boolean>;
    getUserPermissionKeys(user: ActiveUser): Promise<string[]>;
    private assertHasPermissions;
    private assertCanUsePermissions;
    private validatePermissionKeys;
    private syncRolePermissions;
    private resolveAssignableBranchId;
    private findTenantRole;
    private roleInclude;
    private serializeRole;
    private selectPrimaryRoleName;
    private slug;
}
