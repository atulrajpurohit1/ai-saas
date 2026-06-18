"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RolesService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const audit_service_1 = require("../audit/audit.service");
const prisma_service_1 = require("../prisma/prisma.service");
const rbac_constants_1 = require("./rbac.constants");
let RolesService = class RolesService {
    prisma;
    auditService;
    permissionsReady = false;
    tenantSystemRolesReady = new Set();
    constructor(prisma, auditService) {
        this.prisma = prisma;
        this.auditService = auditService;
    }
    async ensurePermissions() {
        if (this.permissionsReady)
            return;
        const existingPermissions = await this.prisma.permission.findMany({
            where: { key: { in: rbac_constants_1.ALL_PERMISSION_KEYS } },
            select: {
                key: true,
                name: true,
                description: true,
                module: true,
            },
        });
        const existingByKey = new Map(existingPermissions.map((permission) => [permission.key, permission]));
        const permissionsToSync = rbac_constants_1.PERMISSIONS.filter((permission) => {
            const existing = existingByKey.get(permission.key);
            return (!existing ||
                existing.name !== permission.name ||
                existing.description !== permission.description ||
                existing.module !== permission.module);
        });
        if (permissionsToSync.length === 0 && existingPermissions.length === rbac_constants_1.PERMISSIONS.length) {
            this.permissionsReady = true;
            return;
        }
        await Promise.all(permissionsToSync.map((permission) => this.prisma.permission.upsert({
            where: { key: permission.key },
            update: {
                name: permission.name,
                description: permission.description,
                module: permission.module,
            },
            create: {
                id: permission.key,
                key: permission.key,
                name: permission.name,
                description: permission.description,
                module: permission.module,
            },
        })));
        this.permissionsReady = true;
    }
    async ensureTenantSystemRoles(tenantId) {
        if (this.tenantSystemRolesReady.has(tenantId))
            return;
        await this.ensurePermissions();
        const existingRoles = await this.prisma.role.findMany({
            where: {
                tenantId,
                name: { in: rbac_constants_1.SYSTEM_ROLES.map((role) => role.name) },
                isActive: true,
                isSystemRole: true,
            },
            include: {
                permissions: {
                    include: {
                        permission: {
                            select: { key: true },
                        },
                    },
                },
            },
        });
        const existingByName = new Map(existingRoles.map((role) => [role.name, role]));
        const rolesAreCurrent = rbac_constants_1.SYSTEM_ROLES.every((definition) => {
            const role = existingByName.get(definition.name);
            if (!role || role.description !== definition.description)
                return false;
            const currentKeys = new Set(role.permissions.map((item) => item.permission.key));
            const expectedKeys = (0, rbac_constants_1.systemRolePermissionKeys)(definition.name);
            return (currentKeys.size === expectedKeys.length &&
                expectedKeys.every((key) => currentKeys.has(key)));
        });
        if (rolesAreCurrent) {
            this.tenantSystemRolesReady.add(tenantId);
            return;
        }
        for (const definition of rbac_constants_1.SYSTEM_ROLES) {
            const role = await this.prisma.role.upsert({
                where: {
                    tenantId_name: {
                        tenantId,
                        name: definition.name,
                    },
                },
                update: {
                    description: definition.description,
                    isSystemRole: true,
                    isActive: true,
                },
                create: {
                    id: `${tenantId}:role:${this.slug(definition.name)}`,
                    tenantId,
                    name: definition.name,
                    description: definition.description,
                    isSystemRole: true,
                    isActive: true,
                },
            });
            await this.syncRolePermissions(role.id, (0, rbac_constants_1.systemRolePermissionKeys)(definition.name));
        }
        this.tenantSystemRolesReady.add(tenantId);
    }
    async ensureDefaultAssignmentForUser(userId) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            include: {
                roleAssignments: {
                    where: { isActive: true },
                    take: 1,
                },
            },
        });
        if (!user)
            return;
        if (user.roleAssignments.length > 0)
            return;
        await this.ensureTenantSystemRoles(user.tenantId);
        const roleName = user.isSuperAdmin
            ? 'Super Admin'
            : user.role === client_1.UserRole.FINANCE
                ? 'Finance'
                : 'Branch Admin';
        const role = await this.prisma.role.findFirst({
            where: {
                tenantId: user.tenantId,
                name: roleName,
                isActive: true,
            },
        });
        if (!role)
            return;
        await this.prisma.userRoleAssignment.create({
            data: {
                tenantId: user.tenantId,
                userId: user.id,
                roleId: role.id,
                branchId: user.isSuperAdmin ? null : user.branchId,
            },
        });
    }
    async getUserAccessProfile(userId) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            include: {
                tenant: true,
                branch: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
                roleAssignments: {
                    where: { isActive: true },
                    include: {
                        role: {
                            include: {
                                permissions: {
                                    include: {
                                        permission: true,
                                    },
                                },
                            },
                        },
                        branch: {
                            select: {
                                id: true,
                                name: true,
                            },
                        },
                    },
                    orderBy: { assignedAt: 'asc' },
                },
            },
        });
        if (!user) {
            throw new common_1.NotFoundException('User not found');
        }
        await this.ensureDefaultAssignmentForUser(user.id);
        const assignments = user.roleAssignments.length > 0
            ? user.roleAssignments
            : await this.prisma.userRoleAssignment.findMany({
                where: { userId: user.id, tenantId: user.tenantId, isActive: true },
                include: {
                    role: {
                        include: {
                            permissions: {
                                include: { permission: true },
                            },
                        },
                    },
                    branch: { select: { id: true, name: true } },
                },
                orderBy: { assignedAt: 'asc' },
            });
        const primaryRoleName = this.selectPrimaryRoleName(assignments.map((assignment) => assignment.role.name), user.role, user.isSuperAdmin);
        const activeUser = {
            sub: user.id,
            email: user.email,
            tenantId: user.tenantId,
            role: (0, rbac_constants_1.roleToPortalRole)(primaryRoleName),
            branchId: user.branchId,
            isSuperAdmin: user.isSuperAdmin,
        };
        const permissionKeys = await this.getUserPermissionKeys(activeUser);
        return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: activeUser.role,
            tenantId: user.tenantId,
            tenantName: user.tenant.name,
            branchId: user.branchId,
            branch: user.branch,
            isSuperAdmin: user.isSuperAdmin,
            roles: assignments
                .filter((assignment) => assignment.role.isActive)
                .map((assignment) => ({
                assignmentId: assignment.id,
                id: assignment.role.id,
                name: assignment.role.name,
                description: assignment.role.description,
                isSystemRole: assignment.role.isSystemRole,
                branchId: assignment.branchId,
                branch: assignment.branch,
            })),
            permissions: permissionKeys,
        };
    }
    async listPermissions() {
        await this.ensurePermissions();
        return this.prisma.permission.findMany({
            orderBy: [{ module: 'asc' }, { key: 'asc' }],
        });
    }
    async listRoles(user) {
        await this.ensureTenantSystemRoles(user.tenantId);
        const roles = await this.prisma.role.findMany({
            where: { tenantId: user.tenantId },
            include: this.roleInclude(),
            orderBy: [{ isSystemRole: 'desc' }, { name: 'asc' }],
        });
        return roles.map((role) => this.serializeRole(role));
    }
    async createRole(user, dto) {
        await this.assertHasPermissions(user, ['roles.manage']);
        await this.ensureTenantSystemRoles(user.tenantId);
        const name = dto.name?.trim();
        if (!name)
            throw new common_1.BadRequestException('Role name is required');
        const permissionKeys = await this.validatePermissionKeys(dto.permission_keys);
        await this.assertCanUsePermissions(user, permissionKeys);
        const role = await this.prisma.$transaction(async (tx) => {
            const created = await tx.role.create({
                data: {
                    tenantId: user.tenantId,
                    name,
                    description: dto.description?.trim() || null,
                    isSystemRole: false,
                    isActive: true,
                },
            });
            if (permissionKeys.length > 0) {
                const permissions = await tx.permission.findMany({
                    where: { key: { in: permissionKeys } },
                    select: { id: true },
                });
                await tx.rolePermission.createMany({
                    data: permissions.map((permission) => ({
                        roleId: created.id,
                        permissionId: permission.id,
                    })),
                    skipDuplicates: true,
                });
            }
            return tx.role.findUniqueOrThrow({
                where: { id: created.id },
                include: this.roleInclude(),
            });
        });
        await this.auditService.log({
            tenantId: user.tenantId,
            userId: user.sub,
            action: 'ROLE_CREATED',
            entityType: 'Role',
            entityId: role.id,
            details: `Role "${role.name}" created with ${permissionKeys.length} permissions`,
        });
        return this.serializeRole(role);
    }
    async updateRole(user, id, dto) {
        await this.assertHasPermissions(user, ['roles.manage']);
        const existing = await this.findTenantRole(user.tenantId, id);
        if (existing.isSystemRole) {
            throw new common_1.ForbiddenException('System roles cannot be edited');
        }
        const permissionKeys = dto.permission_keys === undefined
            ? undefined
            : await this.validatePermissionKeys(dto.permission_keys);
        if (permissionKeys) {
            await this.assertCanUsePermissions(user, permissionKeys);
        }
        const name = dto.name?.trim();
        if (dto.name !== undefined && !name) {
            throw new common_1.BadRequestException('Role name is required');
        }
        const role = await this.prisma.$transaction(async (tx) => {
            await tx.role.update({
                where: { id },
                data: {
                    ...(name !== undefined ? { name } : {}),
                    ...(dto.description !== undefined
                        ? { description: dto.description?.trim() || null }
                        : {}),
                    ...(dto.is_active !== undefined ? { isActive: dto.is_active } : {}),
                },
            });
            if (permissionKeys !== undefined) {
                await tx.rolePermission.deleteMany({ where: { roleId: id } });
                if (permissionKeys.length > 0) {
                    const permissions = await tx.permission.findMany({
                        where: { key: { in: permissionKeys } },
                        select: { id: true },
                    });
                    await tx.rolePermission.createMany({
                        data: permissions.map((permission) => ({
                            roleId: id,
                            permissionId: permission.id,
                        })),
                        skipDuplicates: true,
                    });
                }
            }
            return tx.role.findUniqueOrThrow({
                where: { id },
                include: this.roleInclude(),
            });
        });
        await this.auditService.log({
            tenantId: user.tenantId,
            userId: user.sub,
            action: permissionKeys === undefined ? 'ROLE_UPDATED' : 'ROLE_PERMISSION_CHANGED',
            entityType: 'Role',
            entityId: role.id,
            details: `Role "${role.name}" updated`,
        });
        return this.serializeRole(role);
    }
    async deactivateRole(user, id) {
        await this.assertHasPermissions(user, ['roles.manage']);
        const role = await this.findTenantRole(user.tenantId, id);
        if (role.isSystemRole) {
            throw new common_1.ForbiddenException('System roles cannot be deleted');
        }
        const deactivated = await this.prisma.$transaction(async (tx) => {
            await tx.userRoleAssignment.updateMany({
                where: { roleId: id, isActive: true },
                data: { isActive: false, revokedAt: new Date() },
            });
            return tx.role.update({
                where: { id },
                data: { isActive: false },
                include: this.roleInclude(),
            });
        });
        await this.auditService.log({
            tenantId: user.tenantId,
            userId: user.sub,
            action: 'ROLE_DEACTIVATED',
            entityType: 'Role',
            entityId: id,
            details: `Role "${role.name}" deactivated`,
        });
        return this.serializeRole(deactivated);
    }
    async listUsers(user) {
        const canReadUsers = await this.hasAnyPermission(user, [
            'users.view',
            'users.assign_roles',
        ]);
        if (!canReadUsers) {
            throw new common_1.ForbiddenException('You do not have permission to view users');
        }
        await this.ensureTenantSystemRoles(user.tenantId);
        return this.prisma.user.findMany({
            where: {
                tenantId: user.tenantId,
                ...(user.isSuperAdmin ? {} : { branchId: user.branchId || '__none__' }),
            },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                branchId: true,
                isSuperAdmin: true,
                branch: { select: { id: true, name: true } },
                roleAssignments: {
                    where: { isActive: true },
                    include: {
                        role: true,
                        branch: { select: { id: true, name: true } },
                    },
                    orderBy: { assignedAt: 'asc' },
                },
            },
            orderBy: [{ name: 'asc' }, { email: 'asc' }],
        });
    }
    async assignRole(user, dto) {
        await this.assertHasPermissions(user, ['users.assign_roles']);
        await this.ensureTenantSystemRoles(user.tenantId);
        const targetUser = await this.prisma.user.findFirst({
            where: { id: dto.user_id, tenantId: user.tenantId },
        });
        if (!targetUser)
            throw new common_1.NotFoundException('User not found');
        const role = await this.prisma.role.findFirst({
            where: { id: dto.role_id, tenantId: user.tenantId, isActive: true },
            include: {
                permissions: {
                    include: { permission: true },
                },
            },
        });
        if (!role)
            throw new common_1.NotFoundException('Role not found');
        if (role.name === 'Client' || role.name === 'Guard') {
            throw new common_1.ForbiddenException('Client and guard portal roles cannot be assigned to admin users');
        }
        if (role.name === 'Super Admin' && !user.isSuperAdmin) {
            throw new common_1.ForbiddenException('Only super admins can assign Super Admin');
        }
        const rolePermissionKeys = role.permissions.map((item) => item.permission.key);
        await this.assertCanUsePermissions(user, rolePermissionKeys);
        const branchId = await this.resolveAssignableBranchId(user, dto.branch_id);
        const existing = await this.prisma.userRoleAssignment.findFirst({
            where: {
                userId: targetUser.id,
                roleId: role.id,
                branchId,
            },
        });
        const assignment = existing
            ? await this.prisma.userRoleAssignment.update({
                where: { id: existing.id },
                data: {
                    isActive: true,
                    revokedAt: null,
                    assignedBy: user.sub,
                },
                include: {
                    role: true,
                    branch: { select: { id: true, name: true } },
                },
            })
            : await this.prisma.userRoleAssignment.create({
                data: {
                    tenantId: user.tenantId,
                    userId: targetUser.id,
                    roleId: role.id,
                    branchId,
                    assignedBy: user.sub,
                },
                include: {
                    role: true,
                    branch: { select: { id: true, name: true } },
                },
            });
        await this.prisma.user.update({
            where: { id: targetUser.id },
            data: {
                role: role.name === 'Finance' ? client_1.UserRole.FINANCE : client_1.UserRole.ADMIN,
                isSuperAdmin: role.name === 'Super Admin',
                ...(role.name === 'Super Admin'
                    ? { branchId: null }
                    : branchId !== undefined
                        ? { branchId }
                        : {}),
            },
        });
        await this.auditService.log({
            tenantId: user.tenantId,
            userId: user.sub,
            action: 'USER_ROLE_ASSIGNED',
            entityType: 'UserRoleAssignment',
            entityId: assignment.id,
            details: `Role "${role.name}" assigned to ${targetUser.email}${branchId ? ` for branch ${branchId}` : ''}`,
        });
        return assignment;
    }
    async revokeAssignment(user, assignmentId) {
        await this.assertHasPermissions(user, ['users.assign_roles']);
        const assignment = await this.prisma.userRoleAssignment.findFirst({
            where: { id: assignmentId, tenantId: user.tenantId, isActive: true },
            include: { role: true },
        });
        if (!assignment)
            throw new common_1.NotFoundException('Role assignment not found');
        if (!user.isSuperAdmin && assignment.branchId !== user.branchId) {
            throw new common_1.ForbiddenException('You cannot revoke assignments outside your branch');
        }
        const updated = await this.prisma.userRoleAssignment.update({
            where: { id: assignmentId },
            data: { isActive: false, revokedAt: new Date() },
        });
        await this.auditService.log({
            tenantId: user.tenantId,
            userId: user.sub,
            action: 'USER_ROLE_REVOKED',
            entityType: 'UserRoleAssignment',
            entityId: assignmentId,
            details: `Role "${assignment.role.name}" revoked`,
        });
        return updated;
    }
    async hasPermissions(user, required) {
        if (!required.length)
            return true;
        if (!user?.tenantId || !user.sub)
            return false;
        if (user.role === 'client' || user.role === 'guard')
            return false;
        if (user.isSuperAdmin)
            return true;
        const keys = await this.getUserPermissionKeys(user);
        const granted = new Set(keys);
        return required.every((permission) => granted.has(permission));
    }
    async hasAnyPermission(user, permissions) {
        if (!permissions.length)
            return true;
        if (!user?.tenantId || !user.sub)
            return false;
        if (user.role === 'client' || user.role === 'guard')
            return false;
        if (user.isSuperAdmin)
            return true;
        const keys = await this.getUserPermissionKeys(user);
        const granted = new Set(keys);
        return permissions.some((permission) => granted.has(permission));
    }
    async getUserPermissionKeys(user) {
        if (!user?.tenantId || !user.sub)
            return [];
        if (user.role === 'client' || user.role === 'guard')
            return [];
        if (user.isSuperAdmin)
            return rbac_constants_1.ALL_PERMISSION_KEYS;
        await this.ensureTenantSystemRoles(user.tenantId);
        const assignments = await this.prisma.userRoleAssignment.findMany({
            where: {
                tenantId: user.tenantId,
                userId: user.sub,
                isActive: true,
                OR: [
                    { branchId: null },
                    ...(user.branchId ? [{ branchId: user.branchId }] : []),
                ],
                role: {
                    isActive: true,
                },
            },
            include: {
                role: {
                    include: {
                        permissions: {
                            include: { permission: true },
                        },
                    },
                },
            },
        });
        const keys = new Set();
        for (const assignment of assignments) {
            for (const rolePermission of assignment.role.permissions) {
                keys.add(rolePermission.permission.key);
            }
        }
        if (keys.size > 0)
            return [...keys].sort();
        const dbUser = await this.prisma.user.findUnique({
            where: { id: user.sub },
            select: { role: true, isSuperAdmin: true },
        });
        if (!dbUser)
            return [];
        if (dbUser.isSuperAdmin)
            return rbac_constants_1.ALL_PERMISSION_KEYS;
        return (0, rbac_constants_1.systemRolePermissionKeys)(dbUser.role === client_1.UserRole.FINANCE ? 'Finance' : 'Branch Admin');
    }
    async assertHasPermissions(user, permissions) {
        const allowed = await this.hasPermissions(user, permissions);
        if (!allowed) {
            throw new common_1.ForbiddenException('You do not have permission to perform this action');
        }
    }
    async assertCanUsePermissions(user, requestedKeys) {
        if (user.isSuperAdmin)
            return;
        const actorPermissions = new Set(await this.getUserPermissionKeys(user));
        const denied = requestedKeys.filter((key) => !actorPermissions.has(key));
        if (denied.length > 0) {
            throw new common_1.ForbiddenException(`You cannot assign permissions you do not have: ${denied.join(', ')}`);
        }
    }
    async validatePermissionKeys(permissionKeys) {
        const keys = [...new Set((permissionKeys || []).map((key) => key.trim()).filter(Boolean))];
        const allowed = new Set(rbac_constants_1.ALL_PERMISSION_KEYS);
        const unknown = keys.filter((key) => !allowed.has(key));
        if (unknown.length > 0) {
            throw new common_1.BadRequestException(`Unknown permissions: ${unknown.join(', ')}`);
        }
        return keys;
    }
    async syncRolePermissions(roleId, permissionKeys) {
        const permissions = await this.prisma.permission.findMany({
            where: { key: { in: permissionKeys } },
            select: { id: true },
        });
        const permissionIds = permissions.map((permission) => permission.id);
        await this.prisma.rolePermission.deleteMany({
            where: {
                roleId,
                permissionId: { notIn: permissionIds.length > 0 ? permissionIds : ['__none__'] },
            },
        });
        if (permissionIds.length === 0)
            return;
        await this.prisma.rolePermission.createMany({
            data: permissionIds.map((permissionId) => ({ roleId, permissionId })),
            skipDuplicates: true,
        });
    }
    async resolveAssignableBranchId(user, requestedBranchId) {
        const normalized = requestedBranchId?.trim() || null;
        if (!user.isSuperAdmin) {
            if (!user.branchId)
                return null;
            if (normalized && normalized !== user.branchId) {
                throw new common_1.ForbiddenException('You cannot assign roles outside your branch');
            }
            return user.branchId;
        }
        if (!normalized)
            return null;
        const branch = await this.prisma.branch.findFirst({
            where: { id: normalized, tenantId: user.tenantId },
            select: { id: true },
        });
        if (!branch)
            throw new common_1.BadRequestException('Branch must belong to this tenant');
        return branch.id;
    }
    async findTenantRole(tenantId, id) {
        const role = await this.prisma.role.findFirst({
            where: { id, tenantId },
            include: this.roleInclude(),
        });
        if (!role)
            throw new common_1.NotFoundException('Role not found');
        return role;
    }
    roleInclude() {
        return {
            permissions: {
                include: {
                    permission: true,
                },
            },
            _count: {
                select: {
                    assignments: true,
                },
            },
        };
    }
    serializeRole(role) {
        return {
            id: role.id,
            tenantId: role.tenantId,
            name: role.name,
            description: role.description,
            isSystemRole: role.isSystemRole,
            isActive: role.isActive,
            createdAt: role.createdAt,
            updatedAt: role.updatedAt,
            assignmentCount: role._count?.assignments || 0,
            permissions: (role.permissions || [])
                .map((item) => item.permission)
                .sort((a, b) => a.key.localeCompare(b.key)),
        };
    }
    selectPrimaryRoleName(roleNames, legacyRole, isSuperAdmin) {
        if (isSuperAdmin)
            return 'Super Admin';
        if (roleNames.length === 0) {
            return legacyRole === client_1.UserRole.FINANCE ? 'Finance' : 'Branch Admin';
        }
        const priority = ['Finance', 'Scheduler', 'Supervisor', 'Branch Admin'];
        return priority.find((roleName) => roleNames.includes(roleName)) || roleNames[0];
    }
    slug(value) {
        return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    }
};
exports.RolesService = RolesService;
exports.RolesService = RolesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], RolesService);
//# sourceMappingURL=roles.service.js.map