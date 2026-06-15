import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateFieldPermissionsDto } from './dto/update-field-permissions.dto';
import {
  FIELD_PERMISSION_ENTITIES,
  FieldPermissionAction,
  FieldPermissionEntity,
  SensitiveFieldDefinition,
  getSensitiveFields,
  isFieldPermissionEntity,
  isSensitiveField,
} from './field-permissions.constants';

type EffectiveFieldPermission = SensitiveFieldDefinition & {
  canView: boolean;
  canEdit: boolean;
};

@Injectable()
export class FieldPermissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  listFieldDefinitions() {
    return FIELD_PERMISSION_ENTITIES.map((entity) => ({
      entity,
      fields: getSensitiveFields(entity).map(({ field, label }) => ({
        field,
        label,
      })),
    }));
  }

  async listForRole(user: ActiveUser, roleId: string) {
    const role = await this.findTenantRoleOrThrow(user.tenantId, roleId);
    const rows = await this.prisma.fieldPermission.findMany({
      where: { tenantId: user.tenantId, roleId },
      orderBy: [{ entity: 'asc' }, { field: 'asc' }],
    });

    return {
      roleId: role.id,
      roleName: role.name,
      permissions: FIELD_PERMISSION_ENTITIES.flatMap((entity) =>
        getSensitiveFields(entity).map((definition) => {
          const row = rows.find(
            (item) => item.entity === entity && item.field === definition.field,
          );

          return {
            id: row?.id || null,
            entity,
            field: definition.field,
            label: definition.label,
            canView: row?.canView ?? true,
            canEdit: row?.canEdit ?? true,
          };
        }),
      ),
    };
  }

  async updateRolePermissions(
    user: ActiveUser,
    roleId: string,
    dto: UpdateFieldPermissionsDto,
  ) {
    const role = await this.findTenantRoleOrThrow(user.tenantId, roleId);
    const uniquePermissions = new Map<
      string,
      {
        entity: FieldPermissionEntity;
        field: string;
        canView: boolean;
        canEdit: boolean;
      }
    >();

    for (const item of dto.permissions || []) {
      if (!isFieldPermissionEntity(item.entity)) {
        throw new BadRequestException(`Unknown entity: ${item.entity}`);
      }

      if (!isSensitiveField(item.entity, item.field)) {
        throw new BadRequestException(
          `Unknown sensitive field: ${item.entity}.${item.field}`,
        );
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

  async getEffectivePermissions(user: ActiveUser, entity: string) {
    const normalizedEntity = this.parseEntity(entity);
    return this.resolveEffectivePermissions(user, normalizedEntity);
  }

  async filterFieldsByPermission<T>(
    user: ActiveUser,
    entity: FieldPermissionEntity,
    data: T,
  ): Promise<T> {
    if (data === null || data === undefined) return data;

    const denied = await this.deniedFields(user, entity, 'view');
    if (denied.length === 0) return data;

    const deniedDefinitions = getSensitiveFields(entity).filter((definition) =>
      denied.includes(definition.field),
    );
    const removedFields = new Set<string>();
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

    return filtered as T;
  }

  async assertCanEditFields(
    user: ActiveUser,
    entity: FieldPermissionEntity,
    data: unknown,
    entityId?: string,
  ) {
    const requestedFields = this.sensitiveFieldsInPayload(entity, data);
    if (requestedFields.length === 0) return;

    const denied = await this.deniedFields(user, entity, 'edit');
    const blocked = requestedFields.filter((field) => denied.includes(field));
    if (blocked.length === 0) return;

    await this.auditService.log({
      tenantId: user.tenantId,
      userId: user.sub,
      action: 'FIELD_EDIT_BLOCKED',
      entityType: entity,
      entityId,
      details: `Blocked ${entity} field edit: ${blocked.join(', ')}`,
    });

    throw new ForbiddenException(
      `You do not have permission to edit restricted field(s): ${blocked.join(', ')}`,
    );
  }

  private parseEntity(entity: string): FieldPermissionEntity {
    if (!isFieldPermissionEntity(entity)) {
      throw new BadRequestException(`Unknown field permission entity: ${entity}`);
    }

    return entity;
  }

  private async findTenantRoleOrThrow(tenantId: string, roleId: string) {
    const role = await this.prisma.role.findFirst({
      where: { id: roleId, tenantId, isActive: true },
      select: { id: true, name: true },
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    return role;
  }

  private async deniedFields(
    user: ActiveUser,
    entity: FieldPermissionEntity,
    action: FieldPermissionAction,
  ) {
    const permissions = await this.resolveEffectivePermissions(user, entity);
    return permissions
      .filter((permission) =>
        action === 'view' ? !permission.canView : !permission.canEdit,
      )
      .map((permission) => permission.field);
  }

  private async resolveEffectivePermissions(
    user: ActiveUser,
    entity: FieldPermissionEntity,
  ): Promise<EffectiveFieldPermission[]> {
    const definitions = getSensitiveFields(entity);
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
      const canEdit =
        canView && !matching.some((row) => row.canEdit === false);

      return {
        ...definition,
        canView,
        canEdit,
      };
    });
  }

  private async resolveUserRoleIds(user: ActiveUser) {
    if (!user?.tenantId || !user.sub) return [];

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

  private stripDeniedFields(
    value: unknown,
    deniedDefinitions: SensitiveFieldDefinition[],
    removedFields: Set<string>,
  ) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return value;
    }

    const next = { ...(value as Record<string, unknown>) };
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

  private sensitiveFieldsInPayload(
    entity: FieldPermissionEntity,
    payload: unknown,
  ) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return [];
    }

    const input = payload as Record<string, unknown>;
    return getSensitiveFields(entity)
      .filter((definition) =>
        definition.aliases.some((alias) =>
          Object.prototype.hasOwnProperty.call(input, alias),
        ),
      )
      .map((definition) => definition.field);
  }

  private entityId(value: unknown) {
    if (!value || typeof value !== 'object') return undefined;
    const id = (value as { id?: unknown }).id;
    return typeof id === 'string' ? id : undefined;
  }
}
