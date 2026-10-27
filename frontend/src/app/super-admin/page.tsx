'use client';

import { formatDate as fmtDate } from '@/lib/format';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import PageHeader from '@/components/PageHeader';
import { usePlatformAuth } from '@/context/PlatformAuthContext';
import { getApiErrorMessage } from '@/lib/api-error';
import { cn } from '@/lib/utils';
import {
  COMP_PLAN_LABELS,
  type CompPlanKey,
  type CompRow,
  type PlatformOverview,
  type PlatformTenant,
  type AiUsageBreakdown,
  type RechargeAttempt,
  daysLeft,
  createTenant,
  deleteTenant,
  getAiUsage,
  getOverview,
  getRecharges,
  getTenants,
  grantComp,
  listComps,
  reactivateTenant,
  revokeComp,
  suspendTenant,
} from '@/lib/platform';
import {
  AlertTriangle,
  Ban,
  Building2,
  Coins,
  Gift,
  Loader2,
  LogOut,
  Plus,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Trash2,
  Users,
} from 'lucide-react';

type Tab = 'trials' | 'tenants' | 'ai' | 'recharges';

const EXPIRY_CHOICES = [
  { key: '7', label: '7 days' },
  { key: '15', label: '15 days' },
  { key: '30', label: '30 days' },
  { key: 'custom', label: 'Custom' },
  { key: 'lifetime', label: 'Lifetime' },
] as const;

type ExpiryChoice = (typeof EXPIRY_CHOICES)[number]['key'];

function formatDate(value: string | null) {
  if (!value) return '—';
  return fmtDate(value);
}

function usd(value: number) {
  return `$${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * A coloured pill for a tenant's plan.
 *
 * `plan` is how they came by it (paying, comped, nothing) and sets the colour;
 * `planName` is WHICH plan and sets the text. Showing only the former meant
 * every comped tenant read "Comped" -- the one thing the screen is for is
 * seeing who is on what, and the plan name was missing from it.
 *
 * The "AegisLead " prefix is dropped: every plan has it, so it is noise in a
 * table column this narrow.
 */
function PlanBadge({ plan, planName }: { plan: string; planName?: string | null }) {
  const styles: Record<string, string> = {
    TRIAL: 'bg-amber-500/15 text-amber-600 border-amber-500/30',
    COMP: 'bg-violet-500/15 text-violet-600 border-violet-500/30',
    STRIPE: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30',
    NONE: 'bg-muted text-muted-foreground border-border',
  };
  const fallback =
    plan === 'STRIPE'
      ? 'Paying'
      : plan === 'COMP'
        ? 'Comped'
        : plan === 'TRIAL'
          ? 'Trial'
          : 'No Plan';
  const label = planName
    ? planName.replace(/^AegisLead\s+/, '').replace(/\s+Plan$/, '')
    : fallback;
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold',
        styles[plan] ?? styles.NONE,
      )}
    >
      {label}
    </span>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Building2;
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon size={16} />
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <div className="mt-2 text-2xl font-bold text-foreground">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

function SuperAdminContent() {
  const { admin } = usePlatformAuth();
  const [tab, setTab] = useState<Tab>('trials');

  const [overview, setOverview] = useState<PlatformOverview | null>(null);
  const [comps, setComps] = useState<CompRow[]>([]);
  const [tenants, setTenants] = useState<PlatformTenant[]>([]);
  const [aiUsage, setAiUsage] = useState<AiUsageBreakdown | null>(null);
  const [recharges, setRecharges] = useState<RechargeAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Grant form state.
  const [formTenantId, setFormTenantId] = useState('');
  const [formPlan, setFormPlan] = useState<CompPlanKey>('TRIAL');
  const [formExpiry, setFormExpiry] = useState<ExpiryChoice>('30');
  const [formCustomDays, setFormCustomDays] = useState(30);
  const [formReason, setFormReason] = useState('');
  const [granting, setGranting] = useState(false);
  const [formError, setFormError] = useState('');
  const [formNotice, setFormNotice] = useState('');
  const [revokingId, setRevokingId] = useState<string | null>(null);

  // Tenant management state.
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newOwnerEmail, setNewOwnerEmail] = useState('');
  const [newOwnerName, setNewOwnerName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [creating, setCreating] = useState(false);
  const [tenantError, setTenantError] = useState('');
  const [tenantNotice, setTenantNotice] = useState('');
  const [busyTenantId, setBusyTenantId] = useState<string | null>(null);
  /** The tenant a delete confirmation is open for, plus the typed name. */
  const [deleteTarget, setDeleteTarget] = useState<PlatformTenant | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const [overviewR, compsR, tenantsR, aiR, rechargesR] = await Promise.all([
        getOverview(),
        listComps(),
        getTenants(),
        getAiUsage().catch(() => null),
        getRecharges().catch(() => [] as RechargeAttempt[]),
      ]);
      setOverview(overviewR);
      setComps(compsR);
      setTenants(tenantsR);
      setAiUsage(aiR);
      setRecharges(rechargesR);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Unable to load platform data.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const activeComps = useMemo(() => comps.filter((c) => c.active), [comps]);
  // Grants waiting on a paid plan to run out. Listed apart from the active
  // ones, because "has free access" and "will have free access" are different
  // answers to the only question this screen is asked.
  const scheduledComps = useMemo(
    () => comps.filter((c) => c.scheduled && !c.active),
    [comps],
  );

  const submitGrant = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError('');
    setFormNotice('');

    if (!formTenantId) {
      setFormError('Choose a tenant to grant access to.');
      return;
    }
    if (formReason.trim().length < 3) {
      setFormError('Give a reason for the access (at least 3 characters).');
      return;
    }

    let expiresInDays: number | undefined;
    if (formExpiry === 'lifetime') {
      expiresInDays = undefined;
    } else if (formExpiry === 'custom') {
      if (!Number.isInteger(formCustomDays) || formCustomDays < 1) {
        setFormError('Enter a whole number of days for custom access.');
        return;
      }
      expiresInDays = formCustomDays;
    } else {
      expiresInDays = Number(formExpiry);
    }

    setGranting(true);
    try {
      const result = await grantComp({
        tenantId: formTenantId,
        package: formPlan,
        expiresInDays,
        reason: formReason.trim(),
      });
      const tenantName =
        tenants.find((t) => t.tenantId === formTenantId)?.name ?? formTenantId;
      setFormNotice(
        result.scheduled
          ? `${tenantName} is inside a paid period, so ${COMP_PLAN_LABELS[formPlan]} ` +
            `is queued and starts ${
              result.startsAt
                ? `on ${formatDate(result.startsAt)}`
                : 'when their paid plan ends'
            }. Their paid plan is untouched until then.`
          : `${COMP_PLAN_LABELS[formPlan]} granted to ${tenantName}.`,
      );
      setFormReason('');
      await load();
    } catch (err) {
      setFormError(getApiErrorMessage(err, 'Could not grant access.'));
    } finally {
      setGranting(false);
    }
  };

  const revoke = async (row: CompRow) => {
    const who = row.tenantName ?? row.tenantId;
    if (
      !window.confirm(
        row.scheduled
          ? `Cancel the queued free plan for ${who}? Their paid plan is unaffected -- nothing will take over when it ends.`
          : `Revoke free access for ${who}? They will lose it immediately.`,
      )
    ) {
      return;
    }
    setRevokingId(row.tenantId);
    setError('');
    try {
      await revokeComp({ tenantId: row.tenantId, reason: 'Revoked from super-admin' });
      await load();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not revoke access.'));
    } finally {
      setRevokingId(null);
    }
  };

  const submitCreateTenant = async (event: React.FormEvent) => {
    event.preventDefault();
    setTenantError('');
    setTenantNotice('');

    if (newName.trim().length < 2) {
      setTenantError('Enter the tenant/company name.');
      return;
    }
    // Mirrors the server's floor (CreateTenantDto). Checked here only so the
    // operator finds out before the round trip, never instead of it.
    if (newPassword.length < 12) {
      setTenantError('The owner password must be at least 12 characters.');
      return;
    }

    setCreating(true);
    try {
      const created = await createTenant({
        name: newName.trim(),
        ownerEmail: newOwnerEmail.trim(),
        ownerName: newOwnerName.trim() || undefined,
        ownerPassword: newPassword,
      });
      setTenantNotice(
        `Created ${created.name}. The owner signs in at /login as ${created.ownerEmail}.`,
      );
      setNewName('');
      setNewOwnerEmail('');
      setNewOwnerName('');
      setNewPassword('');
      setShowCreate(false);
      await load();
    } catch (err) {
      setTenantError(getApiErrorMessage(err, 'Could not create the tenant.'));
    } finally {
      setCreating(false);
    }
  };

  const toggleSuspend = async (tenant: PlatformTenant) => {
    setTenantError('');
    setTenantNotice('');
    setBusyTenantId(tenant.tenantId);
    try {
      if (tenant.isActive) {
        const reason =
          window.prompt(
            `Suspend ${tenant.name}? Every user, client and guard on this account will be signed out and blocked from logging in. Their data is kept.

Reason (optional):`,
          ) ?? undefined;
        // prompt() returns null on Cancel, which must not read as an empty
        // reason and go ahead with the suspension.
        if (reason === undefined) return;
        await suspendTenant({ tenantId: tenant.tenantId, reason });
        setTenantNotice(`${tenant.name} is suspended and cannot sign in.`);
      } else {
        await reactivateTenant(tenant.tenantId);
        setTenantNotice(`${tenant.name} can sign in again.`);
      }
      await load();
    } catch (err) {
      setTenantError(getApiErrorMessage(err, 'Could not update the tenant.'));
    } finally {
      setBusyTenantId(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setTenantError('');
    setTenantNotice('');
    setBusyTenantId(deleteTarget.tenantId);
    try {
      const result = await deleteTenant({
        tenantId: deleteTarget.tenantId,
        confirmName: deleteConfirmName.trim(),
      });
      setTenantNotice(`${result.name} and all of its data have been deleted.`);
      setDeleteTarget(null);
      setDeleteConfirmName('');
      await load();
    } catch (err) {
      setTenantError(getApiErrorMessage(err, 'Could not delete the tenant.'));
    } finally {
      setBusyTenantId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading platform data…
      </div>
    );
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'trials', label: 'Trial & free plans' },
    { key: 'tenants', label: 'Tenants' },
    { key: 'ai', label: 'AI usage' },
    { key: 'recharges', label: 'Recharges' },
  ];

  return (
    <>
      <PageHeader
        title="Platform admin"
        description={`Signed in as ${admin?.email}. Monitor every tenant, manage accounts, and grant the AegisLead Trial plan.`}
        icon={ShieldCheck}
      />

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-error/30 bg-error-wash p-3 text-sm text-error">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {overview && (
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
          <StatCard icon={Building2} label="Tenants" value={overview.tenants} />
          <StatCard icon={ShieldCheck} label="Paying" value={overview.subscriptions.paying} />
          <StatCard icon={Gift} label="On Trial" value={overview.subscriptions.trial} />
          <StatCard
            icon={Coins}
            label="Credits out"
            value={overview.creditsOutstanding.toLocaleString()}
            hint="Unspent across all tenants"
          />
          <StatCard
            icon={Sparkles}
            label="AI cost 30d"
            value={usd(overview.ai.costUsd)}
            hint={`${overview.ai.calls.toLocaleString()} calls`}
          />
        </div>
      )}

      <div className="mb-5 flex flex-wrap gap-1 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              'rounded-t-lg px-4 py-2 text-sm font-medium transition',
              tab === t.key
                ? 'border-b-2 border-primary text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'trials' && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,360px)_1fr]">
          {/* Grant form */}
          <form
            onSubmit={submitGrant}
            className="h-fit rounded-xl border border-border bg-card p-5"
          >
            <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Gift size={16} className="text-primary" /> Grant free access
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              The Trial plan unlocks every feature except AI. Tokens are not
              included — the tenant buys their own for prospect search.
            </p>

            {formNotice && (
              <div className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-xs text-emerald-600">
                {formNotice}
              </div>
            )}
            {formError && (
              <div className="mt-3 rounded-lg border border-error/30 bg-error-wash p-2.5 text-xs text-error">
                {formError}
              </div>
            )}

            <label className="mt-4 block text-xs font-medium text-muted-foreground">
              Tenant
              <select
                value={formTenantId}
                onChange={(e) => setFormTenantId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
              >
                <option value="">Select a tenant…</option>
                {tenants.map((t) => (
                  <option key={t.tenantId} value={t.tenantId}>
                    {t.name} {t.plan !== 'NONE' ? `(${t.plan})` : ''}
                  </option>
                ))}
              </select>
            </label>

            <label className="mt-3 block text-xs font-medium text-muted-foreground">
              Plan
              <select
                value={formPlan}
                onChange={(e) => setFormPlan(e.target.value as CompPlanKey)}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
              >
                {(Object.keys(COMP_PLAN_LABELS) as CompPlanKey[]).map((key) => (
                  <option key={key} value={key}>
                    {COMP_PLAN_LABELS[key]}
                    {key === 'TRIAL' ? ' — no AI' : ''}
                  </option>
                ))}
              </select>
            </label>

            <div className="mt-3 text-xs font-medium text-muted-foreground">
              Duration
              <div className="mt-1 flex flex-wrap gap-1.5">
                {EXPIRY_CHOICES.map((choice) => (
                  <button
                    key={choice.key}
                    type="button"
                    onClick={() => setFormExpiry(choice.key)}
                    className={cn(
                      'rounded-lg border px-2.5 py-1.5 text-xs font-medium transition',
                      formExpiry === choice.key
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {choice.label}
                  </button>
                ))}
              </div>
            </div>

            {formExpiry === 'custom' && (
              <label className="mt-3 block text-xs font-medium text-muted-foreground">
                Custom days
                <input
                  type="number"
                  min={1}
                  max={3650}
                  value={formCustomDays}
                  onChange={(e) => setFormCustomDays(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                />
              </label>
            )}

            <label className="mt-3 block text-xs font-medium text-muted-foreground">
              Reason
              <input
                type="text"
                value={formReason}
                onChange={(e) => setFormReason(e.target.value)}
                placeholder="e.g. Pilot customer, agreed 30-day trial"
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
              />
            </label>

            <button
              type="submit"
              disabled={granting}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
            >
              {granting && <Loader2 className="h-4 w-4 animate-spin" />}
              Grant access
            </button>
          </form>

          {/* Active comps list */}
          <div className="rounded-xl border border-border bg-card">
            <div className="border-b border-border px-5 py-3 text-sm font-semibold text-foreground">
              Active free plans ({activeComps.length})
            </div>
            {activeComps.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-muted-foreground">
                No active free plans yet. Grant one on the left.
              </p>
            ) : (
              <div className="divide-y divide-border">
                {activeComps.map((row) => {
                  const left = daysLeft(row.expiresAt);
                  return (
                    <div
                      key={row.tenantId}
                      className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium text-foreground">
                            {row.tenantName ?? row.tenantId}
                          </span>
                          <PlanBadge plan={row.plan} planName={row.planName} />
                        </div>
                        <div className="mt-0.5 truncate text-xs text-muted-foreground">
                          {row.reason ?? 'No reason recorded'}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="text-sm font-semibold text-foreground">
                            {left === null ? 'Lifetime' : `${left} day${left === 1 ? '' : 's'} left`}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {row.expiresAt ? `Until ${formatDate(row.expiresAt)}` : 'No expiry'}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => revoke(row)}
                          disabled={revokingId === row.tenantId}
                          className="flex items-center gap-1.5 rounded-lg border border-error/30 px-2.5 py-1.5 text-xs font-medium text-error transition hover:bg-error-wash disabled:opacity-60"
                        >
                          {revokingId === row.tenantId ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                          Cancel
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/*
            Grants waiting on a paid plan. Only rendered when there are any:
            an empty "nothing queued" panel is noise on a screen that already
            has an empty state above it.
          */}
          {scheduledComps.length > 0 && (
            <div className="rounded-xl border border-border bg-card">
              <div className="border-b border-border px-5 py-3">
                <div className="text-sm font-semibold text-foreground">
                  Starting later ({scheduledComps.length})
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  These tenants are inside a paid period. The free plan takes
                  over when it ends -- their paid plan is untouched until then.
                </p>
              </div>
              <div className="divide-y divide-border">
                {scheduledComps.map((row) => (
                  <div
                    key={row.tenantId}
                    className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-foreground">
                          {row.tenantName ?? row.tenantId}
                        </span>
                        <PlanBadge plan={row.plan} planName={row.planName} />
                      </div>
                      <div className="mt-0.5 truncate text-xs text-muted-foreground">
                        {row.reason ?? 'No reason recorded'}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-sm font-semibold text-foreground">
                          {row.startsAt
                            ? `Starts ${formatDate(row.startsAt)}`
                            : 'Starts when their plan ends'}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {row.days
                            ? `Then ${row.days} day${row.days === 1 ? '' : 's'}`
                            : 'Then open-ended'}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => revoke(row)}
                        disabled={revokingId === row.tenantId}
                        className="flex items-center gap-1.5 rounded-lg border border-error/30 px-2.5 py-1.5 text-xs font-medium text-error transition hover:bg-error-wash disabled:opacity-60"
                      >
                        {revokingId === row.tenantId ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                        Cancel
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'tenants' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-muted-foreground">
              {tenants.length} tenant{tenants.length === 1 ? '' : 's'} ·{' '}
              {tenants.filter((t) => !t.isActive).length} suspended
            </div>
            <button
              type="button"
              onClick={() => {
                setShowCreate((open) => !open);
                setTenantError('');
                setTenantNotice('');
              }}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition hover:opacity-90"
            >
              <Plus className="h-3.5 w-3.5" />
              Add tenant
            </button>
          </div>

          {tenantNotice && (
            <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-600">
              {tenantNotice}
            </p>
          )}
          {tenantError && !deleteTarget && (
            <p
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
            >
              {tenantError}
            </p>
          )}

          {showCreate && (
            <form
              onSubmit={submitCreateTenant}
              className="grid gap-4 rounded-xl border border-border bg-card p-4 sm:grid-cols-2"
            >
              <div className="text-xs text-muted-foreground sm:col-span-2">
                Creates the account and its first owner user. The owner has full
                rights inside their own tenant and no access to this console.
              </div>
              <div>
                <label
                  htmlFor="new-tenant-name"
                  className="mb-1.5 block text-xs font-medium text-muted-foreground"
                >
                  Company name
                </label>
                <input
                  id="new-tenant-name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  required
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                />
              </div>
              <div>
                <label
                  htmlFor="new-owner-name"
                  className="mb-1.5 block text-xs font-medium text-muted-foreground"
                >
                  Owner name{' '}
                  <span className="text-muted-foreground/60">(optional)</span>
                </label>
                <input
                  id="new-owner-name"
                  value={newOwnerName}
                  onChange={(e) => setNewOwnerName(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                />
              </div>
              <div>
                <label
                  htmlFor="new-owner-email"
                  className="mb-1.5 block text-xs font-medium text-muted-foreground"
                >
                  Owner email
                </label>
                <input
                  id="new-owner-email"
                  type="email"
                  value={newOwnerEmail}
                  onChange={(e) => setNewOwnerEmail(e.target.value)}
                  required
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                />
              </div>
              <div>
                <label
                  htmlFor="new-owner-password"
                  className="mb-1.5 block text-xs font-medium text-muted-foreground"
                >
                  Owner password{' '}
                  <span className="text-muted-foreground/60">(min 12 chars)</span>
                </label>
                <input
                  id="new-owner-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={12}
                  autoComplete="new-password"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                />
              </div>
              <div className="flex items-center gap-2 sm:col-span-2">
                <button
                  type="submit"
                  disabled={creating}
                  className="flex items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
                >
                  {creating && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Create tenant
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition hover:text-foreground"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full min-w-[880px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Tenant</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Plan</th>
                  <th className="px-4 py-3 font-medium">Users</th>
                  <th className="px-4 py-3 font-medium">Credits</th>
                  <th className="px-4 py-3 font-medium">AI cost 30d</th>
                  <th className="px-4 py-3 font-medium">Joined</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {tenants.map((t) => (
                  <tr key={t.tenantId} className={cn(!t.isActive && 'opacity-60')}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{t.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {t.email ?? t.slug}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {t.isActive ? (
                        <span className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-600">
                          Active
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-600"
                          title={t.suspendedReason ?? 'No reason recorded'}
                        >
                          Suspended
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <PlanBadge plan={t.plan} planName={t.planName} />
                    </td>
                    <td className="px-4 py-3 text-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Users className="h-3.5 w-3.5 text-muted-foreground" />
                        {t.userCount}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-foreground">
                      {t.creditBalance.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-foreground">{usd(t.aiCostUsd30d)}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDate(t.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => toggleSuspend(t)}
                          disabled={busyTenantId === t.tenantId}
                          title={t.isActive ? 'Suspend (reversible)' : 'Reactivate'}
                          className="flex items-center gap-1 rounded-lg border border-border px-2 py-1.5 text-xs font-medium text-muted-foreground transition hover:text-foreground disabled:opacity-50"
                        >
                          {busyTenantId === t.tenantId ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : t.isActive ? (
                            <Ban className="h-3.5 w-3.5" />
                          ) : (
                            <RotateCcw className="h-3.5 w-3.5" />
                          )}
                          {t.isActive ? 'Suspend' : 'Reactivate'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDeleteTarget(t);
                            setDeleteConfirmName('');
                            setTenantError('');
                            setTenantNotice('');
                          }}
                          title="Delete permanently"
                          className="flex items-center gap-1 rounded-lg border border-destructive/30 px-2 py-1.5 text-xs font-medium text-destructive transition hover:bg-destructive/10"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {tenants.length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-8 text-center text-muted-foreground"
                    >
                      No tenants yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/*
            Typing the tenant's exact name is the confirmation. The server
            requires the same value, so this dialog is the humane presentation
            of a precondition that holds either way -- not the only thing
            standing between a stray click and a deleted customer.
          */}
          {deleteTarget && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
              <div className="w-full max-w-md rounded-xl border border-destructive/40 bg-card p-5">
                <div className="mb-3 flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-5 w-5" />
                  <h2 className="text-sm font-semibold">
                    Delete {deleteTarget.name}?
                  </h2>
                </div>
                <p className="mb-3 text-xs text-muted-foreground">
                  This permanently removes the tenant and everything it owns —{' '}
                  {deleteTarget.userCount} user
                  {deleteTarget.userCount === 1 ? '' : 's'}, plus all leads,
                  invoices, shifts, incidents and evidence. It cannot be undone.
                  To block access without losing the data, suspend the tenant
                  instead.
                </p>
                <label
                  htmlFor="delete-confirm"
                  className="mb-1.5 block text-xs font-medium text-muted-foreground"
                >
                  Type{' '}
                  <span className="font-semibold text-foreground">
                    {deleteTarget.name}
                  </span>{' '}
                  to confirm
                </label>
                <input
                  id="delete-confirm"
                  value={deleteConfirmName}
                  onChange={(e) => setDeleteConfirmName(e.target.value)}
                  autoComplete="off"
                  className="mb-4 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-destructive"
                />
                {tenantError && (
                  <p
                    role="alert"
                    className="mb-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
                  >
                    {tenantError}
                  </p>
                )}
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteTarget(null);
                      setDeleteConfirmName('');
                    }}
                    className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition hover:text-foreground"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={confirmDelete}
                    disabled={
                      busyTenantId === deleteTarget.tenantId ||
                      deleteConfirmName.trim() !== deleteTarget.name.trim()
                    }
                    className="flex items-center gap-2 rounded-lg bg-destructive px-3 py-2 text-xs font-semibold text-destructive-foreground transition hover:opacity-90 disabled:opacity-50"
                  >
                    {busyTenantId === deleteTarget.tenantId && (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    )}
                    Delete permanently
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'ai' && aiUsage && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <div className="border-b border-border px-4 py-3 text-sm font-semibold text-foreground">
              Cost by feature ({aiUsage.windowDays}d)
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2 font-medium">Feature</th>
                  <th className="px-4 py-2 font-medium">Calls</th>
                  <th className="px-4 py-2 font-medium">Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {aiUsage.byFeature.map((f) => (
                  <tr key={f.feature}>
                    <td className="px-4 py-2 text-foreground">{f.feature}</td>
                    <td className="px-4 py-2 text-muted-foreground">{f.calls}</td>
                    <td className="px-4 py-2 text-foreground">{usd(f.totalCostUsd)}</td>
                  </tr>
                ))}
                {aiUsage.byFeature.length === 0 && (
                  <tr><td colSpan={3} className="px-4 py-6 text-center text-muted-foreground">No AI usage in this window.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <div className="border-b border-border px-4 py-3 text-sm font-semibold text-foreground">
              Top tenants by AI cost
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2 font-medium">Tenant</th>
                  <th className="px-4 py-2 font-medium">Calls</th>
                  <th className="px-4 py-2 font-medium">Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {aiUsage.topTenants.map((t) => (
                  <tr key={t.tenantId ?? 'system'}>
                    <td className="px-4 py-2 text-foreground">{t.name}</td>
                    <td className="px-4 py-2 text-muted-foreground">{t.calls}</td>
                    <td className="px-4 py-2 text-foreground">{usd(t.costUsd)}</td>
                  </tr>
                ))}
                {aiUsage.topTenants.length === 0 && (
                  <tr><td colSpan={3} className="px-4 py-6 text-center text-muted-foreground">No AI usage in this window.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'recharges' && (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 font-medium">Tenant</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Pack</th>
                <th className="px-4 py-3 font-medium">Charged</th>
                <th className="px-4 py-3 font-medium">Credits</th>
                <th className="px-4 py-3 font-medium">When</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {recharges.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3 font-medium text-foreground">{r.tenantName ?? r.tenantId}</td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'text-xs font-semibold',
                        r.status === 'SUCCEEDED'
                          ? 'text-emerald-600'
                          : r.status === 'FAILED'
                            ? 'text-error'
                            : 'text-muted-foreground',
                      )}
                    >
                      {r.status}
                    </span>
                    {r.failureReason && (
                      <div className="text-xs text-muted-foreground">{r.failureReason}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{r.packKey}</td>
                  <td className="px-4 py-3 text-foreground">
                    {r.amountCharged === null ? '—' : usd(r.amountCharged)}
                  </td>
                  <td className="px-4 py-3 text-foreground">{r.creditsGranted ?? '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(r.createdAt)}</td>
                </tr>
              ))}
              {recharges.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No recharge attempts yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

/**
 * Standalone shell for the platform-owner area, deliberately NOT the customer
 * DashboardLayout: no tenant sidebar, no module nav, no app chrome. It is its
 * own surface living only at this URL and not linked from the customer app.
 *
 * Access rests on a platform session (PlatformAuthContext), which exists only
 * if `platform-auth/me` succeeded -- a server answer about a PlatformAdmin
 * row, not a flag on a tenant user. Anyone without one is sent to
 * /super-admin/login and sees nothing in between.
 *
 * What this replaced: the gate used to read `user.isSuperAdmin` off the TENANT
 * session, a flag signup set for every tenant's founding user, so every
 * customer reached this console in full. It also redirected to the customer
 * /login, which both told them the route existed and sent them somewhere that
 * could sign them straight back into it. Now an unauthenticated visitor lands
 * on a platform login they cannot pass with tenant credentials, and the API
 * enforces the same boundary with a separate signing secret.
 */
export default function SuperAdminPage() {
  const { admin, loading, logout } = usePlatformAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!admin) router.replace('/super-admin/login');
  }, [admin, loading, router]);

  // Reveal nothing until a platform admin is confirmed: anyone else only ever
  // sees this blank loader before the redirect fires.
  if (loading || !admin) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <div className="h-10 w-10 animate-spin rounded-full border-t-2 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-card/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <span className="text-sm font-semibold text-foreground">
              AegisLead · Platform Admin
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-muted-foreground sm:inline">
              {admin.email}
            </span>
            <button
              type="button"
              onClick={async () => {
                await logout();
                router.replace('/super-admin/login');
              }}
              className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition hover:text-foreground"
            >
              <LogOut className="h-3.5 w-3.5" />
              Logout
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <SuperAdminContent />
      </main>
    </div>
  );
}
