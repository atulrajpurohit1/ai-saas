import api from '@/lib/api';

export type FieldPermissionEntity = 'guard' | 'client' | 'invoice';

export interface FieldPermissionField {
  field: string;
  label: string;
}

export interface FieldPermissionDefinition {
  entity: FieldPermissionEntity;
  fields: FieldPermissionField[];
}

export interface RoleFieldPermission {
  id: string | null;
  entity: FieldPermissionEntity;
  field: string;
  label: string;
  canView: boolean;
  canEdit: boolean;
}

export interface EffectiveFieldPermission {
  entity: FieldPermissionEntity;
  field: string;
  label: string;
  aliases: string[];
  canView: boolean;
  canEdit: boolean;
}

export type FieldAccessMap = Record<string, { canView: boolean; canEdit: boolean }>;

export function toFieldAccessMap(permissions: EffectiveFieldPermission[]) {
  return permissions.reduce<FieldAccessMap>((acc, permission) => {
    acc[permission.field] = {
      canView: permission.canView,
      canEdit: permission.canEdit,
    };
    return acc;
  }, {});
}

export async function getFieldPermissionDefinitions() {
  const res = await api.get<FieldPermissionDefinition[]>('field-permissions/fields');
  return res.data;
}

export async function getRoleFieldPermissions(roleId: string) {
  const res = await api.get<{
    roleId: string;
    roleName: string;
    permissions: RoleFieldPermission[];
  }>(`field-permissions/${roleId}`);
  return res.data;
}

export async function updateRoleFieldPermissions(
  roleId: string,
  permissions: RoleFieldPermission[],
) {
  const res = await api.put(`field-permissions/${roleId}`, {
    permissions: permissions.map((permission) => ({
      entity: permission.entity,
      field: permission.field,
      can_view: permission.canView,
      can_edit: permission.canEdit,
    })),
  });
  return res.data;
}

export async function getEffectiveFieldPermissions(entity: FieldPermissionEntity) {
  const res = await api.get<EffectiveFieldPermission[]>('field-permissions/effective', {
    params: { entity },
  });
  return toFieldAccessMap(res.data);
}
