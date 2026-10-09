'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';
import PageHeader from '@/components/PageHeader';
import LoadingState from '@/components/LoadingState';
import ErrorState from '@/components/ErrorState';
import { getApiErrorMessage } from '@/lib/api-error';
import { getTenantBilling, type TenantBilling } from '@/lib/billing';
import { CreditCard } from 'lucide-react';

const USAGE_LABELS: Record<string, string> = {
  adminUsers: 'Admin users',
  clientUsers: 'Client portal users',
  branches: 'Branches',
  leads: 'Leads',
  deals: 'Deals',
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
        title="Usage"
        description="How much of this account is in use."
      />

      {loading && <LoadingState label="Loading usage…" />}
      {!loading && error && <ErrorState message={error} onRetry={loadBilling} />}

      {!loading && !error && billing && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="mb-5 flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <CreditCard size={20} />
              </span>
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  {billing.tenant?.name ?? 'This account'}
                </h2>
                <p className="text-sm text-muted-foreground">
                  Your plan and pricing live on{' '}
                  <Link
                    href="/settings/plan"
                    className="font-medium text-primary hover:underline"
                  >
                    Your Plan
                  </Link>
                  .
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {Object.entries(billing.usage).map(([key, used]) => (
                <div
                  key={key}
                  className="rounded-xl border border-border bg-background p-4"
                >
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {USAGE_LABELS[key] ?? key}
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-foreground">
                    {used}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {billing.entitlements && (
            <div className="rounded-2xl border border-border bg-card p-6">
              <h3 className="mb-1 text-base font-semibold text-foreground">
                Active services
              </h3>
              <p className="mb-4 text-sm text-muted-foreground">
                The AegisLead services this account can use.
              </p>
              <div className="flex flex-wrap gap-2">
                {(billing.entitlements.modules ?? [])
                  .filter((module) => module.active)
                  .map((module) => (
                    <span
                      key={module.key}
                      className="rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-sm font-medium text-primary"
                    >
                      {module.name}
                    </span>
                  ))}
                {(billing.entitlements.modules ?? []).filter((m) => m.active)
                  .length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No services are active on this account yet.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </DashboardLayout>
  );
}
