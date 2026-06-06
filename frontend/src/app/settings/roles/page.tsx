'use client';

import React, { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import BranchSelect from '@/components/BranchSelect';
import { useAuth } from '@/context/AuthContext';
import { getApiErrorMessage } from '@/lib/api-error';
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
  ShieldCheck,
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

function formatModule(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

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
  }, [canViewUsers]);

  const selectRole = (role: Role) => {
    setSelectedRoleId(role.id);
    setForm({
      name: role.name,
      description: role.description || '',
      permissionKeys: role.permissions.map((permission) => permission.key),
    });
    setError('');
  };

  const startCreate = () => {
    setSelectedRoleId('');
    setForm(emptyForm);
    setError('');
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
    setError('');
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
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not save role.'));
    } finally {
      setSaving(false);
    }
  };

  const removeRole = async () => {
    if (!selectedRole || selectedRole.isSystemRole) return;
    if (!confirm(`Deactivate ${selectedRole.name}?`)) return;

    setSaving(true);
    setError('');
    try {
      await deactivateRole(selectedRole.id);
      setSelectedRoleId('');
      setForm(emptyForm);
      await loadData();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not deactivate role.'));
    } finally {
      setSaving(false);
    }
  };

  const assignRole = async () => {
    if (!assignment.userId || !assignment.roleId) return;
    setSaving(true);
    setError('');
    try {
      await assignUserRole({
        user_id: assignment.userId,
        role_id: assignment.roleId,
        branch_id: assignment.branchId || null,
      });
      await loadData();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not assign role.'));
    } finally {
      setSaving(false);
    }
  };

  const revokeAssignment = async (assignmentId: string) => {
    setSaving(true);
    setError('');
    try {
      await revokeUserRole(assignmentId);
      await loadData();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not revoke role.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout requiredPermissions="roles.view">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="flex items-center gap-3 text-2xl font-bold sm:text-3xl">
            <ShieldCheck className="text-indigo-300" size={28} />
            Roles
          </h2>
          <p className="mt-2 text-muted-foreground">Advanced access control</p>
        </div>
        {canManageRoles && (
          <button
            type="button"
            onClick={startCreate}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-indigo-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-indigo-400"
          >
            <Plus size={18} />
            New Role
          </button>
        )}
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-24 text-center text-muted-foreground">
          <Loader2 className="mx-auto mb-3 animate-spin text-indigo-300" size={28} />
          Loading roles...
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
          <div className="space-y-3">
            {roles.map((role) => (
              <button
                key={role.id}
                type="button"
                onClick={() => selectRole(role)}
                className={`w-full rounded-xl border p-4 text-left transition ${
                  selectedRoleId === role.id
                    ? 'border-indigo-400/60 bg-indigo-500/10'
                    : 'border-white/10 bg-white/[0.04] hover:bg-white/[0.07]'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-bold text-white">{role.name}</div>
                    <div className="mt-1 line-clamp-2 text-sm text-slate-400">
                      {role.description || 'Custom tenant role'}
                    </div>
                  </div>
                  {role.isSystemRole ? (
                    <Lock className="shrink-0 text-slate-500" size={17} />
                  ) : (
                    <span className="shrink-0 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-emerald-300">
                      Custom
                    </span>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold text-slate-400">
                  <span>{role.permissions.length} permissions</span>
                  <span>{role.assignmentCount} assignments</span>
                  {!role.isActive && <span className="text-rose-300">Inactive</span>}
                </div>
              </button>
            ))}
          </div>

          <div className="space-y-6">
            <section className="rounded-xl border border-white/10 bg-white/[0.04] p-4 sm:p-6">
              <div className="mb-5 grid gap-4 lg:grid-cols-[1fr_1fr_auto]">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-300">Name</label>
                  <input
                    value={form.name}
                    onChange={(event) => setForm({ ...form, name: event.target.value })}
                    disabled={!editable && Boolean(selectedRole)}
                    className="min-h-11 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-white outline-none focus:ring-2 focus:ring-indigo-500/50 disabled:opacity-60"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-300">Description</label>
                  <input
                    value={form.description}
                    onChange={(event) => setForm({ ...form, description: event.target.value })}
                    disabled={!editable && Boolean(selectedRole)}
                    className="min-h-11 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-white outline-none focus:ring-2 focus:ring-indigo-500/50 disabled:opacity-60"
                  />
                </div>
                {canManageRoles && (
                  <div className="flex items-end gap-2">
                    <button
                      type="button"
                      onClick={saveRole}
                      disabled={saving || (!editable && Boolean(selectedRole)) || !form.name.trim() || form.permissionKeys.length === 0}
                      className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-indigo-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {saving ? <Loader2 className="animate-spin" size={17} /> : <Save size={17} />}
                      Save
                    </button>
                    {selectedRole && !selectedRole.isSystemRole && (
                      <button
                        type="button"
                        onClick={removeRole}
                        disabled={saving}
                        className="inline-flex min-h-11 items-center justify-center rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 text-rose-300 transition hover:bg-rose-500/20 disabled:opacity-60"
                        aria-label="Deactivate role"
                      >
                        <Trash2 size={17} />
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-5">
                {Object.entries(permissionsByModule).map(([moduleName, modulePermissions]) => (
                  <div key={moduleName} className="rounded-xl border border-white/10 bg-slate-950/20 p-4">
                    <div className="mb-3 text-sm font-black uppercase tracking-widest text-slate-400">
                      {formatModule(moduleName)}
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
                            className={`flex min-h-14 items-center gap-3 rounded-lg border px-3 py-2 text-left transition disabled:cursor-not-allowed disabled:opacity-70 ${
                              checked
                                ? 'border-indigo-400/40 bg-indigo-500/10'
                                : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'
                            }`}
                          >
                            <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                              checked ? 'border-indigo-300 bg-indigo-400 text-slate-950' : 'border-white/20'
                            }`}>
                              {checked && <Check size={14} />}
                            </span>
                            <span className="min-w-0">
                              <span className="block text-sm font-semibold text-white">{permission.name}</span>
                              <span className="block truncate text-xs text-slate-500">{permission.key}</span>
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
              <section className="rounded-xl border border-white/10 bg-white/[0.04] p-4 sm:p-6">
                <div className="mb-5 flex items-center gap-3">
                  <UserPlus className="text-sky-300" size={22} />
                  <h3 className="text-xl font-bold">User Assignments</h3>
                </div>

                <div className="mb-6 grid gap-4 lg:grid-cols-[1fr_1fr_220px_auto]">
                  <select
                    value={assignment.userId}
                    onChange={(event) => setAssignment({ ...assignment, userId: event.target.value })}
                    className="min-h-11 rounded-xl border border-white/10 bg-white/5 px-4 text-white outline-none focus:ring-2 focus:ring-indigo-500/50"
                  >
                    {users.map((item) => (
                      <option key={item.id} value={item.id} className="bg-[#0e0e1a]">
                        {item.name || item.email}
                      </option>
                    ))}
                  </select>
                  <select
                    value={assignment.roleId}
                    onChange={(event) => setAssignment({ ...assignment, roleId: event.target.value })}
                    className="min-h-11 rounded-xl border border-white/10 bg-white/5 px-4 text-white outline-none focus:ring-2 focus:ring-indigo-500/50"
                  >
                    {roles.filter((role) => role.isActive && !['Client', 'Guard'].includes(role.name)).map((role) => (
                      <option key={role.id} value={role.id} className="bg-[#0e0e1a]">
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
                  <button
                    type="button"
                    onClick={assignRole}
                    disabled={saving || !assignment.userId || !assignment.roleId}
                    className="inline-flex min-h-11 items-center justify-center gap-2 self-end rounded-xl bg-sky-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-sky-400 disabled:opacity-60"
                  >
                    {saving ? <Loader2 className="animate-spin" size={17} /> : <UserPlus size={17} />}
                    Assign
                  </button>
                </div>

                <div className="overflow-x-auto rounded-xl border border-white/10">
                  <table className="responsive-table w-full text-left">
                    <thead>
                      <tr className="border-b border-white/10 text-xs uppercase tracking-widest text-slate-500">
                        <th className="px-4 py-3">User</th>
                        <th className="px-4 py-3">Branch</th>
                        <th className="px-4 py-3">Roles</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {users.map((item) => (
                        <tr key={item.id}>
                          <td className="px-4 py-4" data-label="User">
                            <div className="font-semibold text-white">{item.name || item.email}</div>
                            <div className="text-xs text-slate-500">{item.email}</div>
                          </td>
                          <td className="px-4 py-4 text-sm text-slate-400" data-label="Branch">
                            {item.branch?.name || 'Unassigned'}
                          </td>
                          <td className="px-4 py-4" data-label="Roles">
                            <div className="flex flex-wrap gap-2">
                              {item.roleAssignments.map((roleAssignment) => (
                                <span
                                  key={roleAssignment.id}
                                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-bold text-slate-200"
                                >
                                  {roleAssignment.role.name}
                                  {roleAssignment.branch?.name && <span className="text-slate-500">{roleAssignment.branch.name}</span>}
                                  <button
                                    type="button"
                                    onClick={() => revokeAssignment(roleAssignment.id)}
                                    className="text-slate-500 transition hover:text-rose-300"
                                    aria-label="Revoke role"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </span>
                              ))}
                              {item.roleAssignments.length === 0 && (
                                <span className="text-sm text-slate-500">No active roles</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
