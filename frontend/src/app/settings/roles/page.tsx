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
  createTenantUser,
  deactivateRole,
  getPermissions,
  getRoleUsers,
  getRoles,
  revokeUserRole,
  updateRole,
} from '@/lib/roles';
import {
  Check,
  ChevronDown,
  ChevronRight,
  Loader2,
  Lock,
  Plus,
  Save,
  Trash2,
  UserPlus,
  X,
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

type NewUserState = {
  name: string;
  email: string;
  password: string;
  roleId: string;
  branchId: string;
};

const emptyNewUser: NewUserState = {
  name: '',
  email: '',
  password: '',
  roleId: '',
  branchId: '',
};

/**
 * Portal roles, which belong to a client or a guard rather than to a member of
 * staff. The server refuses them here, so they are filtered out of every role
 * picker on this page instead of being offered and then rejected.
 */
const PORTAL_ROLES = ['Client', 'Guard'];

/** Plain-language summaries of the built-in roles.
 *
 *  The role's own description is written for whoever configures permissions
 *  ("Branch-scoped administration for operations teams"), which does not help
 *  someone deciding which one their new bookkeeper should get. These answer
 *  that question instead, and anything custom falls back to its description.
 */
const ROLE_BLURBS: Record<string, string> = {
  'Super Admin': 'Can do everything, including billing and adding users.',
  'Branch Admin': 'Runs one branch: its staff, sites, shifts and reports.',
  Scheduler: 'Plans shifts and assigns guards.',
  Supervisor: 'Handles incidents, reports and timesheets in the field.',
  Finance: 'Invoices, rate cards and financial reporting.',
};

export default function RolesSettingsPage() {
  const { can } = useAuth();
  const canManageRoles = can('roles.manage');
  const canAssignRoles = can('users.assign_roles');
  const canAddUsers = can('users.manage') && canAssignRoles;
  const canViewUsers = can('users.view') || canAssignRoles;
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [users, setUsers] = useState<RoleUser[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [form, setForm] = useState<RoleFormState>(emptyForm);
  const [newUser, setNewUser] = useState<NewUserState>(emptyNewUser);
  const [addingUser, setAddingUser] = useState(false);
  const [assignment, setAssignment] = useState({
    userId: '',
    roleId: '',
    branchId: '',
  });
  // The permission matrix starts closed. It is the part of this screen that
  // made it unusable for anyone who is not configuring access control: a
  // hundred checkboxes above the one thing most people came here to do, which
  // is add a colleague. It is still one click away for whoever needs it.
  const [showAdvanced, setShowAdvanced] = useState(false);
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

  /** Roles a member of staff can actually be given. */
  const assignableRoles = useMemo(
    () => roles.filter((role) => role.isActive && !PORTAL_ROLES.includes(role.name)),
    [roles],
  );

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
      const firstAssignable = roleData.find(
        (role) => role.isActive && !PORTAL_ROLES.includes(role.name),
      );
      setAssignment((current) => ({
        ...current,
        userId: current.userId || userData[0]?.id || '',
        roleId: current.roleId || firstAssignable?.id || '',
      }));
      setNewUser((current) => ({
        ...current,
        roleId: current.roleId || firstAssignable?.id || '',
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
    setShowAdvanced(true);
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

  const addUser = async () => {
    const name = newUser.name.trim();
    const email = newUser.email.trim();

    if (!name || !email || !newUser.password || !newUser.roleId) return;

    setSaving(true);
    try {
      const created = await createTenantUser({
        name,
        email,
        password: newUser.password,
        role_id: newUser.roleId,
        branch_id: newUser.branchId || null,
      });
      // The role is kept for the next one: adding three supervisors in a row
      // should not mean picking the role three times.
      setNewUser({ ...emptyNewUser, roleId: newUser.roleId });
      setAddingUser(false);
      await loadData();
      toast.success(`${created.email} can now sign in.`);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not add the user.'));
    } finally {
      setSaving(false);
    }
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
        title="Team"
        description="The people who can sign in to this account, and what each of them can do."
        actions={
          canAddUsers && !addingUser ? (
            <Button onClick={() => setAddingUser(true)}>
              <UserPlus size={16} />
              Add user
            </Button>
          ) : null
        }
      />

      {error && (
        <div className="mb-6">
          <ErrorState message={error} onRetry={loadData} />
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border border-border bg-card shadow-sm">
          <LoadingState label="Loading your team..." />
        </div>
      ) : (
        <div className="space-y-6">
          {/* ---- Add a user ------------------------------------------------
              The reason this page exists for most people. One form: who they
              are, how they sign in, and what they are allowed to do. */}
          {canAddUsers && addingUser && (
            <section className="rounded-2xl border border-primary/30 bg-card p-4 shadow-sm sm:p-6">
              <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-foreground">Add a user</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Pick a password and pass it on to them. They sign in with
                    the email and password you set here, and can change the
                    password afterwards.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    setAddingUser(false);
                    setNewUser({ ...emptyNewUser, roleId: newUser.roleId });
                  }}
                  aria-label="Cancel"
                >
                  <X size={16} />
                </Button>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground" htmlFor="new-user-name">
                    Full name
                  </label>
                  <Input
                    id="new-user-name"
                    value={newUser.name}
                    onChange={(event) => setNewUser({ ...newUser, name: event.target.value })}
                    placeholder="Jordan Blake"
                    className="min-h-11"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground" htmlFor="new-user-email">
                    Email
                  </label>
                  <Input
                    id="new-user-email"
                    type="email"
                    autoComplete="off"
                    value={newUser.email}
                    onChange={(event) => setNewUser({ ...newUser, email: event.target.value })}
                    placeholder="jordan@yourcompany.com"
                    className="min-h-11"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground" htmlFor="new-user-password">
                    Password
                  </label>
                  <Input
                    id="new-user-password"
                    type="text"
                    autoComplete="new-password"
                    value={newUser.password}
                    onChange={(event) => setNewUser({ ...newUser, password: event.target.value })}
                    placeholder="At least 8 characters"
                    className="min-h-11"
                  />
                  {/* Shown as plain text on purpose: whoever is creating the
                      account has to read it out or paste it to the new user,
                      and a masked field they cannot check is how a typo
                      becomes "the login you gave me does not work". */}
                  <p className="text-xs text-muted-foreground">
                    Visible so you can copy it. At least 8 characters.
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground" htmlFor="new-user-role">
                    Role
                  </label>
                  <select
                    id="new-user-role"
                    value={newUser.roleId}
                    onChange={(event) => setNewUser({ ...newUser, roleId: event.target.value })}
                    className="h-11 w-full rounded-lg border border-input bg-transparent px-3 text-sm text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    {assignableRoles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">
                    {(() => {
                      const role = assignableRoles.find((item) => item.id === newUser.roleId);
                      if (!role) return 'Choose what this person is allowed to do.';
                      return ROLE_BLURBS[role.name] || role.description || 'Custom role.';
                    })()}
                  </p>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <BranchSelect
                    value={newUser.branchId}
                    onChange={(branchId) => setNewUser({ ...newUser, branchId: branchId || '' })}
                    includeAll={false}
                    label="Branch"
                  />
                  <p className="text-xs text-muted-foreground">
                    Leave empty if this person works across every branch.
                  </p>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <Button
                  onClick={addUser}
                  disabled={
                    saving ||
                    !newUser.name.trim() ||
                    !newUser.email.trim() ||
                    newUser.password.length < 8 ||
                    !newUser.roleId
                  }
                >
                  {saving ? <Loader2 className="animate-spin" size={16} /> : <UserPlus size={16} />}
                  Add user
                </Button>
              </div>
            </section>
          )}

          {/* ---- Who is on the team --------------------------------------- */}
          {canViewUsers && (
            <section className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6">
              <div className="mb-5">
                <h3 className="text-base font-semibold text-foreground">
                  Your team{users.length ? ` (${users.length})` : ''}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Everyone who can sign in. Remove a role with the × beside it.
                </p>
              </div>

              {users.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                  Nobody else has been added yet.
                  {canAddUsers && ' Use “Add user” above to invite someone.'}
                </p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-border">
                  <Table className="responsive-table">
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground">Person</TableHead>
                        <TableHead className="px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground">Branch</TableHead>
                        <TableHead className="px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground">Roles</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="px-4 py-4 whitespace-normal" data-label="Person">
                            <div className="font-semibold text-foreground">{item.name || item.email}</div>
                            <div className="text-xs text-muted-foreground">{item.email}</div>
                          </TableCell>
                          <TableCell className="px-4 py-4 text-sm whitespace-normal text-muted-foreground" data-label="Branch">
                            {item.branch?.name || 'All branches'}
                          </TableCell>
                          <TableCell className="px-4 py-4 whitespace-normal" data-label="Roles">
                            <div className="flex flex-wrap gap-2">
                              {item.roleAssignments.map((roleAssignment) => (
                                <span
                                  key={roleAssignment.id}
                                  className="inline-flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-foreground"
                                >
                                  {roleAssignment.role.name}
                                  {roleAssignment.branch?.name && (
                                    <span className="text-muted-foreground">{roleAssignment.branch.name}</span>
                                  )}
                                  {canAssignRoles && (
                                    <button
                                      type="button"
                                      onClick={() => revokeAssignment(roleAssignment.id)}
                                      className="text-muted-foreground transition hover:text-error"
                                      aria-label={`Remove the ${roleAssignment.role.name} role`}
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  )}
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
              )}

              {/* Changing an existing person's role. Kept, but below the list
                  rather than above it: it is the follow-up action, not the
                  first thing anyone does on this page. */}
              {canAssignRoles && users.length > 0 && (
                <div className="mt-6 rounded-xl border border-border bg-background p-4">
                  <div className="mb-4 text-sm font-semibold text-foreground">
                    Give someone another role
                  </div>
                  <div className="grid gap-4 lg:grid-cols-[1fr_1fr_220px_auto]">
                    <select
                      value={assignment.userId}
                      onChange={(event) => setAssignment({ ...assignment, userId: event.target.value })}
                      aria-label="User"
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
                      aria-label="Role"
                      className="h-11 rounded-lg border border-input bg-transparent px-3 text-sm text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    >
                      {assignableRoles.map((role) => (
                        <option key={role.id} value={role.id}>
                          {role.name}
                        </option>
                      ))}
                    </select>
                    <BranchSelect
                      value={assignment.branchId}
                      onChange={(branchId) => setAssignment({ ...assignment, branchId })}
                      includeAll={false}
                      label="Branch"
                    />
                    <Button
                      onClick={assignRole}
                      disabled={saving || !assignment.userId || !assignment.roleId}
                      className="self-end"
                      variant="outline"
                    >
                      {saving ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}
                      Assign
                    </Button>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* ---- Advanced: the permission matrix ---------------------------
              Collapsed by default. Everything below here is for someone
              deliberately changing what a role may do, which is a rare and
              separate job from adding a colleague. */}
          <section className="rounded-2xl border border-border bg-card shadow-sm">
            <button
              type="button"
              onClick={() => setShowAdvanced((current) => !current)}
              className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left sm:px-6"
              aria-expanded={showAdvanced}
            >
              <span>
                <span className="block text-base font-semibold text-foreground">
                  Advanced: what each role can do
                </span>
                <span className="mt-1 block text-sm text-muted-foreground">
                  Fine-grained permissions. You only need this to build a custom
                  role — the built-in ones already cover most teams.
                </span>
              </span>
              {showAdvanced ? (
                <ChevronDown className="shrink-0 text-muted-foreground" size={20} />
              ) : (
                <ChevronRight className="shrink-0 text-muted-foreground" size={20} />
              )}
            </button>

            {showAdvanced && (
              <div className="border-t border-border p-4 sm:p-6">
                {canManageRoles && (
                  <div className="mb-5 flex justify-end">
                    <Button variant="outline" onClick={startCreate}>
                      <Plus size={16} />
                      New role
                    </Button>
                  </div>
                )}

                <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
                  <div className="space-y-3">
                    {roles.map((role) => (
                      <button
                        key={role.id}
                        type="button"
                        onClick={() => selectRole(role)}
                        className={cn(
                          'w-full rounded-xl border p-4 text-left transition',
                          selectedRoleId === role.id
                            ? 'border-primary/40 bg-primary/5'
                            : 'border-border bg-card hover:bg-muted',
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate font-semibold text-foreground">{role.name}</div>
                            <div className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                              {ROLE_BLURBS[role.name] || role.description || 'Custom role'}
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

                  <div>
                    {selectedRole?.isSystemRole && (
                      <p className="mb-4 flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-3 text-sm text-muted-foreground">
                        <Lock size={14} className="shrink-0" />
                        {selectedRole.name} is a built-in role, so its
                        permissions cannot be changed. Create a new role to set
                        your own.
                      </p>
                    )}

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
                            disabled={
                              saving ||
                              (!editable && Boolean(selectedRole)) ||
                              !form.name.trim() ||
                              form.permissionKeys.length === 0
                            }
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
                                    checked
                                      ? 'border-primary/40 bg-primary/5'
                                      : 'border-border bg-card hover:bg-muted',
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
                                    <span className="block text-sm font-semibold text-foreground">
                                      {permission.name}
                                    </span>
                                    <span className="block truncate text-xs text-muted-foreground">
                                      {permission.description || permission.key}
                                    </span>
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </DashboardLayout>
  );
}
