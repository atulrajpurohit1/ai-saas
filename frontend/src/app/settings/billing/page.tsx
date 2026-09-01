'use client';

import React, { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import PageHeader from '@/components/PageHeader';
import LoadingState from '@/components/LoadingState';
import ErrorState from '@/components/ErrorState';
import { getApiErrorMessage } from '@/lib/api-error';
import { getTenantBilling, type TenantBilling } from '@/lib/billing';
import { cn } from '@/lib/utils';
import { CheckCircle2, CreditCard } from 'lucide-react';

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
  prioritySupport: 'Priority Support',
};

export default function BillingSettingsPage() {
  const [billing, setBilling] = useState<TenantBilling | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadBilling = async () => {
    setError('');
    setLoading(true);
    try {
      setBilling(await getTenantBilling());
    } catch (err) {
      setError(getApiErrorMessage(err, 'Unable to load billing usage.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBilling();
  }, []);

  return (
    <DashboardLayout>
      <PageHeader
        title="Billing"
        description="Plan limits, tenant usage, and feature availability."
        actions={
          billing && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-2.5 text-right">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">Current plan</p>
              <p className="text-base font-semibold text-foreground">{billing.plan.name}</p>
            </div>
          )
        }
      />

      {error && (
        <div className="mb-6">
          <ErrorState message={error} onRetry={loadBilling} />
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border border-border bg-card shadow-sm">
          <LoadingState label="Loading billing usage..." />
        </div>
      ) : billing ? (
        <div className="space-y-6">
          <section className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <CreditCard size={20} />
              </div>
              <div>
                <h3 className="text-base font-semibold text-foreground">{billing.tenant?.name || 'Tenant'} Usage</h3>
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
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
              <h3 className="mb-4 text-base font-semibold text-foreground">Features</h3>
              <div className="space-y-3">
                {Object.entries(billing.features).map(([key, enabled]) => (
                  <div key={key} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background p-3">
                    <span className="text-sm text-foreground">{FEATURE_LABELS[key] || key}</span>
                    <span
                      className={cn(
                        'rounded-md border px-2.5 py-1 text-xs font-semibold',
                        enabled ? 'border-success/20 bg-success-wash text-success' : 'border-border bg-muted text-muted-foreground',
                      )}
                    >
                      {enabled ? 'Enabled' : 'Locked'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
              <h3 className="mb-4 text-base font-semibold text-foreground">Available Plans</h3>
              <div className="grid gap-4 md:grid-cols-2">
                {billing.availablePlans.map((plan) => (
                  <div
                    key={plan.key}
                    className={cn(
                      'rounded-xl border p-4',
                      plan.key === billing.plan.key ? 'border-primary/30 bg-primary/5' : 'border-border bg-background',
                    )}
                  >
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-foreground">{plan.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {plan.monthlyPrice === null ? 'Custom' : `$${plan.monthlyPrice}/mo`}
                        </p>
                      </div>
                      {plan.key === billing.plan.key && <CheckCircle2 size={18} className="text-success" />}
                    </div>
                    <div className="space-y-1 text-xs text-muted-foreground">
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
    <div className={cn('rounded-xl border p-4', item.exceeded ? 'border-error/30 bg-error-wash' : 'border-border bg-background')}>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={cn('h-full rounded-full', item.exceeded ? 'bg-error' : 'bg-primary')}
          style={{ width: item.limit === null ? '100%' : `${percent}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {item.limit === null ? 'No limit' : `${item.remaining} remaining`}
      </p>
    </div>
  );
}
