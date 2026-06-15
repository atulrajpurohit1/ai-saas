import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { AssignUserRoleDto } from './dto/assign-user-role.dto';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { RolesService } from './roles.service';
export declare class RolesController {
    private readonly rolesService;
    constructor(rolesService: RolesService);
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
                isActive: boolean;
                description: string | null;
                isSystemRole: boolean;
            };
            branch: {
                id: string;
                name: string;
            } | null;
        } & {
            id: string;
            tenantId: string;
            branchId: string | null;
            isActive: boolean;
            userId: string;
            roleId: string;
            assignedBy: string | null;
            assignedAt: Date;
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
            isActive: boolean;
            description: string | null;
            isSystemRole: boolean;
        };
        branch: {
            id: string;
            name: string;
        } | null;
    } & {
        id: string;
        tenantId: string;
        branchId: string | null;
        isActive: boolean;
        userId: string;
        roleId: string;
        assignedBy: string | null;
        assignedAt: Date;
        revokedAt: Date | null;
    }>;
    revokeAssignment(user: ActiveUser, id: string): Promise<{
        id: string;
        tenantId: string;
        branchId: string | null;
        isActive: boolean;
        userId: string;
        roleId: string;
        assignedBy: string | null;
        assignedAt: Date;
        revokedAt: Date | null;
    }>;
}
