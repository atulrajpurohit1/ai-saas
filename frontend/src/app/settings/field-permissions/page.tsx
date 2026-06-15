'use client';

import React, { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { getApiErrorMessage } from '@/lib/api-error';
import {
  FieldPermissionDefinition,
  FieldPermissionEntity,
  RoleFieldPermission,
  getFieldPermissionDefinitions,
  getRoleFieldPermissions,
  updateRoleFieldPermissions,
} from '@/lib/field-permissions';
import { Role, getRoles } from '@/lib/roles';
import {
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  Pencil,
  Save,
  ShieldCheck,
} from 'lucide-react';

const entityLabels: Record<FieldPermissionEntity, string> = {
  guard: 'Guard',
  client: 'Client',
  invoice: 'Invoice',
};

export default function FieldPermissionsPage() {
  const { can } = useAuth();
  const canManage = can('roles.manage');
  const [roles, setRoles] = useState<Role[]>([]);
  const [definitions, setDefinitions] = useState<FieldPermissionDefinition[]>([]);
  const [permissions, setPermissions] = useState<RoleFieldPermission[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [selectedEntity, setSelectedEntity] = useState<FieldPermissionEntity>('guard');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const selectedRole = roles.find((role) => role.id === selectedRoleId) || null;

  const entityOptions = useMemo(
    () => definitions.map((definition) => definition.entity),
    [definitions],
  );

  const currentPermissions = useMemo(
    () => permissions.filter((permission) => permission.entity === selectedEntity),
    [permissions, selectedEntity],
  );

  const loadBaseData = async () => {
    setLoading(true);
    setError('');
    try {
      const [roleData, definitionData] = await Promise.all([
        getRoles(),
        getFieldPermissionDefinitions(),
      ]);
      setRoles(roleData);
      setDefinitions(definitionData);
      setSelectedRoleId((current) => current || roleData[0]?.id || '');
      setSelectedEntity((current) => current || definitionData[0]?.entity || 'guard');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not load field permissions.'));
    } finally {
      setLoading(false);
    }
  };

  const loadRolePermissions = async (roleId: string) => {
    if (!roleId) return;
    setError('');
    try {
      const data = await getRoleFieldPermissions(roleId);
      setPermissions(data.permissions);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not load role field permissions.'));
    }
  };

  useEffect(() => {
    loadBaseData();
  }, []);

  useEffect(() => {
    loadRolePermissions(selectedRoleId);
  }, [selectedRoleId]);

  const updatePermission = (
    target: RoleFieldPermission,
    key: 'canView' | 'canEdit',
    value: boolean,
  ) => {
    setPermissions((current) =>
      current.map((permission) => {
        if (permission.entity !== target.entity || permission.field !== target.field) {
          return permission;
        }

        if (key === 'canView' && !value) {
          return { ...permission, canView: false, canEdit: false };
        }

        return { ...permission, [key]: value };
      }),
    );
  };

  const savePermissions = async () => {
    if (!selectedRoleId) return;
    setSaving(true);
    setError('');
    try {
      const data = await updateRoleFieldPermissions(selectedRoleId, permissions);
      setPermissions(data.permissions);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not save field permissions.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout requiredPermissions="roles.view">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="flex items-center gap-3 text-2xl font-bold sm:text-3xl">
            <LockKeyhole className="text-indigo-300" size={28} />
            Field Permissions
          </h2>
          <p className="mt-2 text-muted-foreground">Sensitive field access by role</p>
        </div>
        <button
          type="button"
          onClick={savePermissions}
          disabled={!canManage || !selectedRoleId || saving}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-indigo-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
          Save
        </button>
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-24 text-center text-muted-foreground">
          <Loader2 className="mx-auto mb-3 animate-spin text-indigo-300" size={28} />
          Loading field permissions...
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-slate-500">
                Role
              </label>
              <select
                value={selectedRoleId}
                onChange={(event) => setSelectedRoleId(event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-indigo-500/40"
              >
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-bold uppercase tracking-widest text-slate-500">
                Entity
              </div>
              {entityOptions.map((entity) => (
                <button
                  key={entity}
                  type="button"
                  onClick={() => setSelectedEntity(entity)}
                  className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left text-sm font-bold transition ${
                    selectedEntity === entity
                      ? 'border-indigo-400/60 bg-indigo-500/10 text-white'
                      : 'border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06]'
                  }`}
                >
                  <span>{entityLabels[entity]}</span>
                  <ShieldCheck size={16} className="text-indigo-300" />
                </button>
              ))}
            </div>
          </aside>

          <section className="rounded-2xl border border-white/10 bg-white/[0.04]">
            <div className="flex flex-col gap-2 border-b border-white/10 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-xl font-bold text-white">
                  {selectedRole?.name || 'Role'} - {entityLabels[selectedEntity]}
                </h3>
                <p className="mt-1 text-sm text-slate-400">
                  View and edit access for sensitive fields
                </p>
              </div>
              {!canManage && (
                <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-xs font-bold text-amber-200">
                  Read only
                </span>
              )}
            </div>

            <div className="divide-y divide-white/10">
              {currentPermissions.map((permission) => (
                <div
                  key={`${permission.entity}:${permission.field}`}
                  className="grid gap-4 p-5 md:grid-cols-[minmax(0,1fr)_160px_160px]"
                >
                  <div>
                    <div className="font-bold text-white">{permission.label}</div>
                    <div className="mt-1 font-mono text-xs text-slate-500">
                      {permission.entity}.{permission.field}
                    </div>
                  </div>

                  <label className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/10 px-4 py-3 text-sm font-bold text-slate-200">
                    <span className="inline-flex items-center gap-2">
                      {permission.canView ? <Eye size={16} /> : <EyeOff size={16} />}
                      View
                    </span>
                    <input
                      type="checkbox"
                      checked={permission.canView}
                      disabled={!canManage}
                      onChange={(event) =>
                        updatePermission(permission, 'canView', event.target.checked)
                      }
                      className="h-5 w-5 accent-indigo-500"
                    />
                  </label>

                  <label className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/10 px-4 py-3 text-sm font-bold text-slate-200">
                    <span className="inline-flex items-center gap-2">
                      <Pencil size={16} />
                      Edit
                    </span>
                    <input
                      type="checkbox"
                      checked={permission.canEdit}
                      disabled={!canManage || !permission.canView}
                      onChange={(event) =>
                        updatePermission(permission, 'canEdit', event.target.checked)
                      }
                      className="h-5 w-5 accent-indigo-500"
                    />
                  </label>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </DashboardLayout>
  );
}
