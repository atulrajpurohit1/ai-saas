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
exports.FieldPermissionsService = void 0;
const common_1 = require("@nestjs/common");
const audit_service_1 = require("../audit/audit.service");
const prisma_service_1 = require("../prisma/prisma.service");
const field_permissions_constants_1 = require("./field-permissions.constants");
let FieldPermissionsService = class FieldPermissionsService {
    prisma;
    auditService;
    constructor(prisma, auditService) {
        this.prisma = prisma;
        this.auditService = auditService;
    }
    listFieldDefinitions() {
        return field_permissions_constants_1.FIELD_PERMISSION_ENTITIES.map((entity) => ({
            entity,
            fields: (0, field_permissions_constants_1.getSensitiveFields)(entity).map(({ field, label }) => ({
                field,
                label,
            })),
        }));
    }
    async listForRole(user, roleId) {
        const role = await this.findTenantRoleOrThrow(user.tenantId, roleId);
        const rows = await this.prisma.fieldPermission.findMany({
            where: { tenantId: user.tenantId, roleId },
            orderBy: [{ entity: 'asc' }, { field: 'asc' }],
        });
        return {
            roleId: role.id,
            roleName: role.name,
            permissions: field_permissions_constants_1.FIELD_PERMISSION_ENTITIES.flatMap((entity) => (0, field_permissions_constants_1.getSensitiveFields)(entity).map((definition) => {
                const row = rows.find((item) => item.entity === entity && item.field === definition.field);
                return {
                    id: row?.id || null,
                    entity,
                    field: definition.field,
                    label: definition.label,
                    canView: row?.canView ?? true,
                    canEdit: row?.canEdit ?? true,
                };
            })),
        };
    }
    async updateRolePermissions(user, roleId, dto) {
        const role = await this.findTenantRoleOrThrow(user.tenantId, roleId);
        const uniquePermissions = new Map();
        for (const item of dto.permissions || []) {
            if (!(0, field_permissions_constants_1.isFieldPermissionEntity)(item.entity)) {
                throw new common_1.BadRequestException(`Unknown entity: ${item.entity}`);
            }
            if (!(0, field_permissions_constants_1.isSensitiveField)(item.entity, item.field)) {
                throw new common_1.BadRequestException(`Unknown sensitive field: ${item.entity}.${item.field}`);
            }
            uniquePermissions.set(`${item.entity}:${item.field}`, {
                entity: item.entity,
                field: item.field,
                canView: item.can_view,
                canEdit: item.can_view ? item.can_edit : false,
            });
        }
        for (const item of uniquePermissions.values()) {
            const existing = await this.prisma.fieldPermission.findUnique({
                where: {
                    roleId_entity_field: {
                        roleId,
                        entity: item.entity,
                        field: item.field,
                    },
                },
            });
            const saved = await this.prisma.fieldPermission.upsert({
                where: {
                    roleId_entity_field: {
                        roleId,
                        entity: item.entity,
                        field: item.field,
                    },
                },
                update: {
                    canView: item.canView,
                    canEdit: item.canEdit,
                },
                create: {
                    tenantId: user.tenantId,
                    roleId,
                    entity: item.entity,
                    field: item.field,
                    canView: item.canView,
                    canEdit: item.canEdit,
                },
            });
            await this.auditService.log({
                tenantId: user.tenantId,
                userId: user.sub,
                action: existing ? 'FIELD_PERMISSION_UPDATED' : 'FIELD_PERMISSION_CREATED',
                entityType: 'FieldPermission',
                entityId: saved.id,
                details: `${role.name}: ${item.entity}.${item.field} view=${item.canView} edit=${item.canEdit}`,
            });
        }
        return this.listForRole(user, roleId);
    }
    async getEffectivePermissions(user, entity) {
        const normalizedEntity = this.parseEntity(entity);
        return this.resolveEffectivePermissions(user, normalizedEntity);
    }
    async filterFieldsByPermission(user, entity, data) {
        if (data === null || data === undefined)
            return data;
        const denied = await this.deniedFields(user, entity, 'view');
        if (denied.length === 0)
            return data;
        const deniedDefinitions = (0, field_permissions_constants_1.getSensitiveFields)(entity).filter((definition) => denied.includes(definition.field));
        const removedFields = new Set();
        const filtered = Array.isArray(data)
            ? data.map((item) => this.stripDeniedFields(item, deniedDefinitions, removedFields))
            : this.stripDeniedFields(data, deniedDefinitions, removedFields);
        if (removedFields.size > 0) {
            await this.auditService.log({
                tenantId: user.tenantId,
                userId: user.sub,
                action: 'FIELD_ACCESS_BLOCKED',
                entityType: entity,
                entityId: !Array.isArray(data) ? this.entityId(data) : undefined,
                details: `Blocked ${entity} field access: ${[...removedFields].join(', ')}`,
            });
        }
        return filtered;
    }
    async assertCanEditFields(user, entity, data, entityId) {
        const requestedFields = this.sensitiveFieldsInPayload(entity, data);
        if (requestedFields.length === 0)
            return;
        const denied = await this.deniedFields(user, entity, 'edit');
        const blocked = requestedFields.filter((field) => denied.includes(field));
        if (blocked.length === 0)
            return;
        await this.auditService.log({
            tenantId: user.tenantId,
            userId: user.sub,
            action: 'FIELD_EDIT_BLOCKED',
            entityType: entity,
            entityId,
            details: `Blocked ${entity} field edit: ${blocked.join(', ')}`,
        });
        throw new common_1.ForbiddenException(`You do not have permission to edit restricted field(s): ${blocked.join(', ')}`);
    }
    parseEntity(entity) {
        if (!(0, field_permissions_constants_1.isFieldPermissionEntity)(entity)) {
            throw new common_1.BadRequestException(`Unknown field permission entity: ${entity}`);
        }
        return entity;
    }
    async findTenantRoleOrThrow(tenantId, roleId) {
        const role = await this.prisma.role.findFirst({
            where: { id: roleId, tenantId, isActive: true },
            select: { id: true, name: true },
        });
        if (!role) {
            throw new common_1.NotFoundException('Role not found');
        }
        return role;
    }
    async deniedFields(user, entity, action) {
        const permissions = await this.resolveEffectivePermissions(user, entity);
        return permissions
            .filter((permission) => action === 'view' ? !permission.canView : !permission.canEdit)
            .map((permission) => permission.field);
    }
    async resolveEffectivePermissions(user, entity) {
        const definitions = (0, field_permissions_constants_1.getSensitiveFields)(entity);
        if (user.isSuperAdmin) {
            return definitions.map((definition) => ({
                ...definition,
                canView: true,
                canEdit: true,
            }));
        }
        const roleIds = await this.resolveUserRoleIds(user);
        if (roleIds.length === 0) {
            return definitions.map((definition) => ({
                ...definition,
                canView: true,
                canEdit: true,
            }));
        }
        const rows = await this.prisma.fieldPermission.findMany({
            where: {
                tenantId: user.tenantId,
                roleId: { in: roleIds },
                entity,
            },
        });
        return definitions.map((definition) => {
            const matching = rows.filter((row) => row.field === definition.field);
            const canView = !matching.some((row) => row.canView === false);
            const canEdit = canView && !matching.some((row) => row.canEdit === false);
            return {
                ...definition,
                canView,
                canEdit,
            };
        });
    }
    async resolveUserRoleIds(user) {
        if (!user?.tenantId || !user.sub)
            return [];
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
            select: { roleId: true },
        });
        return [...new Set(assignments.map((assignment) => assignment.roleId))];
    }
    stripDeniedFields(value, deniedDefinitions, removedFields) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
            return value;
        }
        const next = { ...value };
        for (const definition of deniedDefinitions) {
            for (const alias of definition.aliases) {
                if (Object.prototype.hasOwnProperty.call(next, alias)) {
                    delete next[alias];
                    removedFields.add(definition.field);
                }
            }
        }
        return next;
    }
    sensitiveFieldsInPayload(entity, payload) {
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
            return [];
        }
        const input = payload;
        return (0, field_permissions_constants_1.getSensitiveFields)(entity)
            .filter((definition) => definition.aliases.some((alias) => Object.prototype.hasOwnProperty.call(input, alias)))
            .map((definition) => definition.field);
    }
    entityId(value) {
        if (!value || typeof value !== 'object')
            return undefined;
        const id = value.id;
        return typeof id === 'string' ? id : undefined;
    }
};
exports.FieldPermissionsService = FieldPermissionsService;
exports.FieldPermissionsService = FieldPermissionsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], FieldPermissionsService);
//# sourceMappingURL=field-permissions.service.js.map