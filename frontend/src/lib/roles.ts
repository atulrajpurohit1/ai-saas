import api from '@/lib/api';

export interface Permission {
  id: string;
  key: string;
  name: string;
  description?: string | null;
  module: string;
}

export interface Role {
  id: string;
  tenantId: string;
  name: string;
  description?: string | null;
  isSystemRole: boolean;
  isActive: boolean;
  assignmentCount: number;
  permissions: Permission[];
}

export interface RoleUser {
  id: string;
  email: string;
  name?: string | null;
  branchId?: string | null;
  isSuperAdmin: boolean;
  branch?: { id: string; name: string } | null;
  roleAssignments: {
    id: string;
    branchId?: string | null;
    role: {
      id: string;
      name: string;
      isSystemRole: boolean;
    };
    branch?: { id: string; name: string } | null;
  }[];
}

export async function getPermissions() {
  const res = await api.get<Permission[]>('roles/permissions');
  return res.data;
}

export async function getRoles() {
  const res = await api.get<Role[]>('roles');
  return res.data;
}

export async function createRole(data: {
  name: string;
  description?: string;
  permission_keys: string[];
}) {
  const res = await api.post<Role>('roles', data);
  return res.data;
}

export async function updateRole(
  id: string,
  data: {
    name?: string;
    description?: string;
    permission_keys?: string[];
    is_active?: boolean;
  },
) {
  const res = await api.put<Role>(`roles/${id}`, data);
  return res.data;
}

export async function deactivateRole(id: string) {
  const res = await api.delete<Role>(`roles/${id}`);
  return res.data;
}

export async function getRoleUsers() {
  const res = await api.get<RoleUser[]>('roles/users');
  return res.data;
}

export async function assignUserRole(data: {
  user_id: string;
  role_id: string;
  branch_id?: string | null;
}) {
  const res = await api.post('roles/assignments', data);
  return res.data;
}

export async function revokeUserRole(assignmentId: string) {
  const res = await api.delete(`roles/assignments/${assignmentId}`);
  return res.data;
}
