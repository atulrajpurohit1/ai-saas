'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import DashboardLayout from '@/components/DashboardLayout';
import PageHeader from '@/components/PageHeader';
import LoadingState from '@/components/LoadingState';
import ErrorState from '@/components/ErrorState';
import BranchSelect from '@/components/BranchSelect';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/context/AuthContext';
import { getApiErrorMessage } from '@/lib/api-error';
import { formatEnumLabel } from '@/lib/format';
import { cn } from '@/lib/utils';
import {
  Permission,
  Role,
  RoleUser,
  assignUserRole,
  createRole,
  deactivateRole,
  getPermissions,
  getRoleUsers,
  getRoles,
  revokeUserRole,
  updateRole,
} from '@/lib/roles';
import {
  Check,
  Loader2,
  Lock,
  Plus,
  Save,
  Trash2,
  UserPlus,
} from 'lucide-react';

type RoleFormState = {
  name: string;
  description: string;
  permissionKeys: string[];
};

const emptyForm: RoleFormState = {
  name: '',
  description: '',
  permissionKeys: [],
};

export default function RolesSettingsPage() {
  const { can } = useAuth();
  const canManageRoles = can('roles.manage');
  const canAssignRoles = can('users.assign_roles');
  const canViewUsers = can('users.view') || canAssignRoles;
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [users, setUsers] = useState<RoleUser[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [form, setForm] = useState<RoleFormState>(emptyForm);
  const [assignment, setAssignment] = useState({
    userId: '',
    roleId: '',
    branchId: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const selectedRole = roles.find((role) => role.id === selectedRoleId) || null;

  const permissionsByModule = useMemo(() => {
    return permissions.reduce<Record<string, Permission[]>>((acc, permission) => {
      acc[permission.module] = acc[permission.module] || [];
      acc[permission.module].push(permission);
      return acc;
    }, {});
  }, [permissions]);

  const editable = canManageRoles && !selectedRole?.isSystemRole;

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [permissionData, roleData, userData] = await Promise.all([
        getPermissions(),
        getRoles(),
        canViewUsers ? getRoleUsers() : Promise.resolve([]),
      ]);
      setPermissions(permissionData);
      setRoles(roleData);
      setUsers(userData);

      const firstRole = roleData[0];
      if (!selectedRoleId && firstRole) {
        setSelectedRoleId(firstRole.id);
        setForm({
          name: firstRole.name,
          description: firstRole.description || '',
          permissionKeys: firstRole.permissions.map((permission) => permission.key),
        });
      }
      setAssignment((current) => ({
        ...current,
        userId: current.userId || userData[0]?.id || '',
        roleId: current.roleId || roleData.find((role) => role.isActive && !['Client', 'Guard'].includes(role.name))?.id || '',
      }));
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not load roles.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canViewUsers]);

  const selectRole = (role: Role) => {
    setSelectedRoleId(role.id);
    setForm({
      name: role.name,
      description: role.description || '',
      permissionKeys: role.permissions.map((permission) => permission.key),
    });
  };

  const startCreate = () => {
    setSelectedRoleId('');
    setForm(emptyForm);
  };

  const togglePermission = (permissionKey: string) => {
    setForm((current) => {
      const exists = current.permissionKeys.includes(permissionKey);
      return {
        ...current,
        permissionKeys: exists
          ? current.permissionKeys.filter((key) => key !== permissionKey)
          : [...current.permissionKeys, permissionKey],
      };
    });
  };

  const saveRole = async () => {
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        permission_keys: form.permissionKeys,
      };
      const saved = selectedRole
        ? await updateRole(selectedRole.id, payload)
        : await createRole(payload);
      await loadData();
      setSelectedRoleId(saved.id);
      selectRole(saved);
      toast.success('Role saved.');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not save role.'));
    } finally {
      setSaving(false);
    }
  };

  const removeRole = async () => {
    if (!selectedRole || selectedRole.isSystemRole) return;
    if (!confirm(`Deactivate ${selectedRole.name}?`)) return;

    setSaving(true);
    try {
      await deactivateRole(selectedRole.id);
      setSelectedRoleId('');
      setForm(emptyForm);
      await loadData();
      toast.success('Role deactivated.');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not deactivate role.'));
    } finally {
      setSaving(false);
    }
  };

  const assignRole = async () => {
    if (!assignment.userId || !assignment.roleId) return;
    setSaving(true);
    try {
      await assignUserRole({
        user_id: assignment.userId,
        role_id: assignment.roleId,
        branch_id: assignment.branchId || null,
      });
      await loadData();
      toast.success('Role assigned.');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not assign role.'));
    } finally {
      setSaving(false);
    }
  };

  const revokeAssignment = async (assignmentId: string) => {
    setSaving(true);
    try {
      await revokeUserRole(assignmentId);
      await loadData();
      toast.success('Role revoked.');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not revoke role.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout requiredPermissions="roles.view">
      <PageHeader
        title="Roles"
        description="Advanced access control."
        actions={
          canManageRoles && (
            <Button onClick={startCreate}>
              <Plus size={16} />
              New Role
            </Button>
          )
        }
      />

      {error && (
        <div className="mb-6">
          <ErrorState message={error} onRetry={loadData} />
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border border-border bg-card shadow-sm">
          <LoadingState label="Loading roles..." />
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
          <div className="space-y-3">
            {roles.map((role) => (
              <button
                key={role.id}
                type="button"
                onClick={() => selectRole(role)}
                className={cn(
                  'w-full rounded-xl border p-4 text-left transition',
                  selectedRoleId === role.id ? 'border-primary/40 bg-primary/5' : 'border-border bg-card hover:bg-muted',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-foreground">{role.name}</div>
                    <div className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      {role.description || 'Custom tenant role'}
                    </div>
                  </div>
                  {role.isSystemRole ? (
                    <Lock className="shrink-0 text-muted-foreground" size={16} />
                  ) : (
                    <span className="shrink-0 rounded-full border border-success/20 bg-success-wash px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-success">
                      Custom
                    </span>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-medium text-muted-foreground">
                  <span>{role.permissions.length} permissions</span>
                  <span>{role.assignmentCount} assignments</span>
                  {!role.isActive && <span className="text-error">Inactive</span>}
                </div>
              </button>
            ))}
          </div>

          <div className="space-y-6">
            <section className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6">
              <div className="mb-5 grid gap-4 lg:grid-cols-[1fr_1fr_auto]">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Name</label>
                  <Input
                    value={form.name}
                    onChange={(event) => setForm({ ...form, name: event.target.value })}
                    disabled={!editable && Boolean(selectedRole)}
                    className="min-h-11"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Description</label>
                  <Input
                    value={form.description}
                    onChange={(event) => setForm({ ...form, description: event.target.value })}
                    disabled={!editable && Boolean(selectedRole)}
                    className="min-h-11"
                  />
                </div>
                {canManageRoles && (
                  <div className="flex items-end gap-2">
                    <Button
                      onClick={saveRole}
                      disabled={saving || (!editable && Boolean(selectedRole)) || !form.name.trim() || form.permissionKeys.length === 0}
                    >
                      {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                      Save
                    </Button>
                    {selectedRole && !selectedRole.isSystemRole && (
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={removeRole}
                        disabled={saving}
                        aria-label="Deactivate role"
                        className="border-error/20 bg-error-wash text-error hover:bg-error-wash hover:text-error"
                      >
                        <Trash2 size={16} />
                      </Button>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-5">
                {Object.entries(permissionsByModule).map(([moduleName, modulePermissions]) => (
                  <div key={moduleName} className="rounded-xl border border-border bg-background p-4">
                    <div className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                      {formatEnumLabel(moduleName)}
                    </div>
                    <div className="grid gap-2 md:grid-cols-2">
                      {modulePermissions.map((permission) => {
                        const checked = form.permissionKeys.includes(permission.key);
                        const disabled = !editable && Boolean(selectedRole);

                        return (
                          <button
                            key={permission.key}
                            type="button"
                            onClick={() => !disabled && togglePermission(permission.key)}
                            disabled={disabled}
                            className={cn(
                              'flex min-h-14 items-center gap-3 rounded-lg border px-3 py-2 text-left transition disabled:cursor-not-allowed disabled:opacity-70',
                              checked ? 'border-primary/40 bg-primary/5' : 'border-border bg-card hover:bg-muted',
                            )}
                          >
                            <span
                              className={cn(
                                'flex h-5 w-5 shrink-0 items-center justify-center rounded border',
                                checked ? 'border-primary bg-primary text-white' : 'border-border',
                              )}
                            >
                              {checked && <Check size={14} />}
                            </span>
                            <span className="min-w-0">
                              <span className="block text-sm font-semibold text-foreground">{permission.name}</span>
                              <span className="block truncate text-xs text-muted-foreground">{permission.key}</span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {canAssignRoles && (
              <section className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6">
                <div className="mb-5 flex items-center gap-3">
                  <UserPlus className="text-primary" size={20} />
                  <h3 className="text-base font-semibold text-foreground">User Assignments</h3>
                </div>

                <div className="mb-6 grid gap-4 lg:grid-cols-[1fr_1fr_220px_auto]">
                  <select
                    value={assignment.userId}
                    onChange={(event) => setAssignment({ ...assignment, userId: event.target.value })}
                    className="h-11 rounded-lg border border-input bg-transparent px-3 text-sm text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    {users.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name || item.email}
                      </option>
                    ))}
                  </select>
                  <select
                    value={assignment.roleId}
                    onChange={(event) => setAssignment({ ...assignment, roleId: event.target.value })}
                    className="h-11 rounded-lg border border-input bg-transparent px-3 text-sm text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    {roles.filter((role) => role.isActive && !['Client', 'Guard'].includes(role.name)).map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                  <BranchSelect
                    value={assignment.branchId}
                    onChange={(branchId) => setAssignment({ ...assignment, branchId })}
                    includeAll={false}
                    label="Branch Scope"
                  />
                  <Button
                    onClick={assignRole}
                    disabled={saving || !assignment.userId || !assignment.roleId}
                    className="self-end"
                  >
                    {saving ? <Loader2 className="animate-spin" size={16} /> : <UserPlus size={16} />}
                    Assign
                  </Button>
                </div>

                <div className="overflow-x-auto rounded-xl border border-border">
                  <Table className="responsive-table">
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground">User</TableHead>
                        <TableHead className="px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground">Branch</TableHead>
                        <TableHead className="px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground">Roles</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="px-4 py-4 whitespace-normal" data-label="User">
                            <div className="font-semibold text-foreground">{item.name || item.email}</div>
                            <div className="text-xs text-muted-foreground">{item.email}</div>
                          </TableCell>
                          <TableCell className="px-4 py-4 text-sm whitespace-normal text-muted-foreground" data-label="Branch">
                            {item.branch?.name || 'Unassigned'}
                          </TableCell>
                          <TableCell className="px-4 py-4 whitespace-normal" data-label="Roles">
                            <div className="flex flex-wrap gap-2">
                              {item.roleAssignments.map((roleAssignment) => (
                                <span
                                  key={roleAssignment.id}
                                  className="inline-flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-foreground"
                                >
                                  {roleAssignment.role.name}
                                  {roleAssignment.branch?.name && <span className="text-muted-foreground">{roleAssignment.branch.name}</span>}
                                  <button
                                    type="button"
                                    onClick={() => revokeAssignment(roleAssignment.id)}
                                    className="text-muted-foreground transition hover:text-error"
                                    aria-label="Revoke role"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </span>
                              ))}
                              {item.roleAssignments.length === 0 && (
                                <span className="text-sm text-muted-foreground">No active roles</span>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </section>
            )}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
