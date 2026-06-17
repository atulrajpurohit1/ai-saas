'use client';

import React, { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { getTenantBilling, type TenantBilling } from '@/lib/billing';
import { AlertTriangle, CheckCircle2, CreditCard, Loader2 } from 'lucide-react';

const LIMIT_LABELS: Record<string, string> = {
  adminUsers: 'Admin users',
  clientUsers: 'Client portal users',
  branches: 'Branches',
  leads: 'Leads',
  deals: 'Deals',
};

const FEATURE_LABELS: Record<string, string> = {
  salesAccelerator: 'Sales Accelerator',
  salesAutomation: 'Sales Automation',
  publicApi: 'Public API',
  customDomains: 'Custom Domains',
  sso: 'SSO',
  prioritySupport: 'Priority Support',
};

export default function BillingSettingsPage() {
  const [billing, setBilling] = useState<TenantBilling | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadBilling = async () => {
      setError('');
      setLoading(true);
      try {
        setBilling(await getTenantBilling());
      } catch (err: any) {
        setError(err?.response?.data?.message || 'Unable to load billing usage.');
      } finally {
        setLoading(false);
      }
    };

    loadBilling();
  }, []);

  return (
    <DashboardLayout>
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold sm:text-3xl">Billing</h2>
          <p className="text-muted-foreground">Plan limits, tenant usage, and feature availability.</p>
        </div>
        {billing && (
          <div className="rounded-lg border border-indigo-500/20 bg-indigo-500/10 px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-wider text-indigo-200">Current plan</p>
            <p className="text-lg font-bold text-white">{billing.plan.name}</p>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-rose-500/20 bg-rose-500/10 p-4 text-rose-100">
          <AlertTriangle size={20} className="mt-0.5 shrink-0" />
          <span className="text-sm font-medium">{error}</span>
        </div>
      )}

      {loading ? (
        <div className="glass-card flex min-h-80 items-center justify-center rounded-lg border border-white/10 text-muted-foreground">
          <Loader2 size={22} className="mr-2 animate-spin" />
          Loading billing usage...
        </div>
      ) : billing ? (
        <div className="space-y-6">
          <section className="glass-card rounded-lg border border-white/10 p-5 sm:p-6">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-indigo-500/20 bg-indigo-500/10 text-indigo-300">
                <CreditCard size={22} />
              </div>
              <div>
                <h3 className="text-lg font-bold">{billing.tenant?.name || 'Tenant'} Usage</h3>
                <p className="text-sm text-muted-foreground">Plan source: {billing.plan.source || 'default'}</p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              {Object.entries(billing.limits).map(([key, item]) => (
                <LimitCard key={key} label={LIMIT_LABELS[key] || key} item={item} />
              ))}
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
            <div className="glass-card rounded-lg border border-white/10 p-5 sm:p-6">
              <h3 className="mb-4 text-lg font-bold">Features</h3>
              <div className="space-y-3">
                {Object.entries(billing.features).map(([key, enabled]) => (
                  <div key={key} className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/20 p-3">
                    <span className="text-sm text-slate-200">{FEATURE_LABELS[key] || key}</span>
                    <span className={`rounded-md border px-2.5 py-1 text-xs font-bold ${
                      enabled
                        ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200'
                        : 'border-slate-500/20 bg-slate-500/10 text-slate-300'
                    }`}>
                      {enabled ? 'Enabled' : 'Locked'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-card rounded-lg border border-white/10 p-5 sm:p-6">
              <h3 className="mb-4 text-lg font-bold">Available Plans</h3>
              <div className="grid gap-4 md:grid-cols-2">
                {billing.availablePlans.map((plan) => (
                  <div
                    key={plan.key}
                    className={`rounded-lg border p-4 ${
                      plan.key === billing.plan.key
                        ? 'border-indigo-500/40 bg-indigo-500/10'
                        : 'border-white/10 bg-black/20'
                    }`}
                  >
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="font-bold text-white">{plan.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {plan.monthlyPrice === null ? 'Custom' : `$${plan.monthlyPrice}/mo`}
                        </p>
                      </div>
                      {plan.key === billing.plan.key && <CheckCircle2 size={20} className="text-emerald-300" />}
                    </div>
                    <div className="space-y-1 text-xs text-slate-400">
                      {Object.entries(plan.limits || {}).map(([limitKey, value]) => (
                        <p key={limitKey}>
                          {LIMIT_LABELS[limitKey] || limitKey}: {value === null ? 'Unlimited' : value}
                        </p>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </DashboardLayout>
  );
}

function LimitCard({ label, item }: { label: string; item: TenantBilling['limits'][string] }) {
  const percent = item.percent ?? 0;
  const value = item.limit === null ? `${item.used} / Unlimited` : `${item.used} / ${item.limit}`;

  return (
    <div className={`rounded-lg border p-4 ${item.exceeded ? 'border-rose-500/30 bg-rose-500/10' : 'border-white/10 bg-black/20'}`}>
      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-bold text-white">{value}</p>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className={`h-full rounded-full ${item.exceeded ? 'bg-rose-400' : 'bg-indigo-400'}`}
          style={{ width: item.limit === null ? '100%' : `${percent}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {item.limit === null ? 'No limit' : `${item.remaining} remaining`}
      </p>
    </div>
  );
}
