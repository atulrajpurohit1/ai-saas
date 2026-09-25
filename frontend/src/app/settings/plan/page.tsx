'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import PageHeader from '@/components/PageHeader';
import { useAuth } from '@/context/AuthContext';
import {
  SERVICE_MODULE_LABELS,
  ServiceModuleKey,
  moduleSummary,
} from '@/lib/entitlements';
import { cn } from '@/lib/utils';
import {
  getCheckoutAvailability,
  startCheckout,
  type CheckoutAvailability,
} from '@/lib/billing';
import { getApiErrorMessage } from '@/lib/api-error';
import { BrainCircuit, Check, DollarSign, Lock, ShieldCheck } from 'lucide-react';

const MODULE_ICONS: Record<ServiceModuleKey, typeof BrainCircuit> = {
  LEAD_GEN: BrainCircuit,
  GUARD_TOUR: ShieldCheck,
  FINANCE: DollarSign,
};

const MODULE_HIGHLIGHTS: Record<ServiceModuleKey, string[]> = {
  LEAD_GEN: [
    'Prospect search and lead qualification',
    'Deal pipeline and proposals',
    'RFP generation and vendor evaluation',
  ],
  GUARD_TOUR: [
    'Patrol routes with checkpoint photo evidence',
    'Live incident reporting and emergency alerts',
    'Guard compliance and accountability',
  ],
  FINANCE: [
    'Scheduling and workforce management',
    'Rate cards and automated invoicing',
    'Finance and profitability reporting',
  ],
};

function PlanContent() {
  const { entitlements } = useAuth();
  const searchParams = useSearchParams();
  const requested = searchParams.get('module') as ServiceModuleKey | null;
  const checkoutState = searchParams.get('checkout');

  const [availability, setAvailability] = useState<CheckoutAvailability | null>(null);
  const [pending, setPending] = useState<ServiceModuleKey | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getCheckoutAvailability()
      .then(setAvailability)
      .catch(() => {
        // Availability is an enhancement: if it cannot be read, fall back to
        // the contact route rather than blocking the page.
        setAvailability({ configured: false, monthly: [], annual: [] });
      });
  }, []);

  const buy = async (module: ServiceModuleKey) => {
    setError('');
    setPending(module);
    try {
      const { url } = await startCheckout([module]);
      if (url) {
        window.location.href = url;
        return;
      }
      setError('Stripe did not return a checkout link. Please try again.');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Unable to start checkout.'));
    } finally {
      setPending(null);
    }
  };

  const modules = useMemo(() => moduleSummary(entitlements), [entitlements]);
  const requestedName =
    requested && SERVICE_MODULE_LABELS[requested]
      ? SERVICE_MODULE_LABELS[requested]
      : null;

  return (
    <DashboardLayout>
      <PageHeader
        title="Your plan"
        description="The AegisLead services active on this account."
      />

      {checkoutState === 'success' && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
          <Check className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
          <div>
            <p className="font-semibold text-foreground">Payment received</p>
            <p className="text-sm text-muted-foreground">
              Your new services are being activated. Sign out and back in if
              they are not visible within a minute.
            </p>
          </div>
        </div>
      )}

      {checkoutState === 'cancelled' && (
        <div className="mb-6 rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
          Checkout was cancelled. Nothing has been charged and your plan is
          unchanged.
        </div>
      )}

      {error && (
        <div className="mb-6 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-foreground">
          {error}
        </div>
      )}

      {requestedName && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
          <Lock className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <p className="font-semibold text-foreground">
              {requestedName} is not part of your plan
            </p>
            <p className="text-sm text-muted-foreground">
              The page you tried to open belongs to {requestedName}. Add it below
              to enable it for your team.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        {modules.map((module) => {
          const Icon = MODULE_ICONS[module.key];

          return (
            <div
              key={module.key}
              className={cn(
                'flex flex-col rounded-xl border p-5 transition-colors',
                module.active
                  ? 'border-primary/30 bg-primary/5'
                  : 'border-border bg-card',
                requested === module.key && !module.active && 'ring-2 ring-amber-500/40',
              )}
            >
              <div className="mb-3 flex items-center justify-between">
                <span
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-lg',
                    module.active
                      ? 'bg-primary/10 text-primary'
                      : 'bg-muted text-muted-foreground',
                  )}
                >
                  <Icon className="h-5 w-5" />
                </span>
                {module.active ? (
                  <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-primary">
                    <Check className="h-3 w-3" /> Active
                  </span>
                ) : (
                  <span className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <Lock className="h-3 w-3" /> Not included
                  </span>
                )}
              </div>

              <h3 className="text-base font-semibold text-foreground">
                {module.name}
                <span className="align-super text-[10px] text-muted-foreground">
                  &trade;
                </span>
              </h3>
              <p className="mt-1 text-sm font-medium text-foreground/80">
                {module.tagline}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">{module.blurb}</p>

              <ul className="mt-4 space-y-2">
                {MODULE_HIGHLIGHTS[module.key].map((highlight) => (
                  <li
                    key={highlight}
                    className="flex items-start gap-2 text-sm text-muted-foreground"
                  >
                    <Check
                      className={cn(
                        'mt-0.5 h-4 w-4 shrink-0',
                        module.active ? 'text-primary' : 'text-muted-foreground/50',
                      )}
                    />
                    {highlight}
                  </li>
                ))}
              </ul>

              {!module.active &&
                (availability?.configured &&
                availability.monthly.includes(module.key) ? (
                  <button
                    type="button"
                    onClick={() => void buy(module.key)}
                    disabled={pending !== null}
                    className="mt-5 inline-flex w-full items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
                  >
                    {pending === module.key
                      ? 'Redirecting…'
                      : `Add ${module.name}`}
                  </button>
                ) : (
                  // No price configured yet, so there is nothing to sell.
                  // Offer a real route rather than a button that would 503.
                  <a
                    href={`mailto:sales@aegislead.com?subject=${encodeURIComponent(
                      `Add ${module.name} to our AegisLead plan`,
                    )}`}
                    className="mt-5 inline-flex w-full items-center justify-center rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
                  >
                    Contact us about {module.name}
                  </a>
                ))}
            </div>
          );
        })}
      </div>

      <p className="mt-6 text-sm text-muted-foreground">
        Need to change users, branches or usage limits?{' '}
        <Link href="/settings/billing" className="font-medium text-primary hover:underline">
          View billing and usage
        </Link>
        .
      </p>
    </DashboardLayout>
  );
}

export default function PlanSettingsPage() {
  return (
    <Suspense
      fallback={
        <DashboardLayout>
          <PageHeader title="Your plan" description="Loading plan details." />
        </DashboardLayout>
      }
    >
      <PlanContent />
    </Suspense>
  );
}
