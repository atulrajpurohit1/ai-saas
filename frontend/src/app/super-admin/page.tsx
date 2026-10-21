'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import PageHeader from '@/components/PageHeader';
import { useAuth } from '@/context/AuthContext';
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
  getAiUsage,
  getOverview,
  getRecharges,
  getTenants,
  grantComp,
  listComps,
  revokeComp,
} from '@/lib/platform';
import {
  AlertTriangle,
  Building2,
  Coins,
  Gift,
  Loader2,
  ShieldCheck,
  Sparkles,
  Trash2,
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
  return new Date(value).toLocaleDateString(undefined, { dateStyle: 'medium' });
}

function usd(value: number) {
  return `$${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** A coloured pill for a tenant's plan. */
function PlanBadge({ plan }: { plan: string }) {
  const styles: Record<string, string> = {
    TRIAL: 'bg-amber-500/15 text-amber-600 border-amber-500/30',
    COMP: 'bg-violet-500/15 text-violet-600 border-violet-500/30',
    STRIPE: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30',
    NONE: 'bg-muted text-muted-foreground border-border',
  };
  const label =
    plan === 'STRIPE'
      ? 'Paying'
      : plan === 'COMP'
        ? 'Comped'
        : plan === 'TRIAL'
          ? 'Trial'
          : 'None';
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
  const { user } = useAuth();
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
      await grantComp({
        tenantId: formTenantId,
        package: formPlan,
        expiresInDays,
        reason: formReason.trim(),
      });
      const tenantName =
        tenants.find((t) => t.tenantId === formTenantId)?.name ?? formTenantId;
      setFormNotice(`${COMP_PLAN_LABELS[formPlan]} granted to ${tenantName}.`);
      setFormReason('');
      await load();
    } catch (err) {
      setFormError(getApiErrorMessage(err, 'Could not grant access.'));
    } finally {
      setGranting(false);
    }
  };

  const revoke = async (row: CompRow) => {
    if (
      !window.confirm(
        `Revoke free access for ${row.tenantName ?? row.tenantId}? They will lose it immediately.`,
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
        description={`Signed in as ${user?.email}. Monitor every tenant and grant the AegisLead Trial plan.`}
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
                          <PlanBadge plan={row.plan} />
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
        </div>
      )}

      {tab === 'tenants' && (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 font-medium">Tenant</th>
                <th className="px-4 py-3 font-medium">Plan</th>
                <th className="px-4 py-3 font-medium">AI</th>
                <th className="px-4 py-3 font-medium">Credits</th>
                <th className="px-4 py-3 font-medium">AI cost 30d</th>
                <th className="px-4 py-3 font-medium">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {tenants.map((t) => (
                <tr key={t.tenantId}>
                  <td className="px-4 py-3 font-medium text-foreground">{t.name}</td>
                  <td className="px-4 py-3"><PlanBadge plan={t.plan} /></td>
                  <td className="px-4 py-3">
                    <span className={t.aiEnabled ? 'text-emerald-600' : 'text-muted-foreground'}>
                      {t.aiEnabled ? 'On' : 'Off'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-foreground">{t.creditBalance.toLocaleString()}</td>
                  <td className="px-4 py-3 text-foreground">{usd(t.aiCostUsd30d)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(t.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
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

export default function SuperAdminPage() {
  const { user, loading } = useAuth();

  return (
    <DashboardLayout>
      {loading ? null : user?.isSuperAdmin ? (
        <SuperAdminContent />
      ) : (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <ShieldCheck className="mb-3 h-10 w-10 text-muted-foreground" />
          <h1 className="text-lg font-semibold text-foreground">Platform admin only</h1>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            This area is restricted to platform administrators. If you believe
            you should have access, contact the platform owner.
          </p>
        </div>
      )}
    </DashboardLayout>
  );
}
