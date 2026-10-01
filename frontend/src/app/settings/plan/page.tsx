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
  getPlanPricing,
  startPlanCheckout,
  type GuardBand,
  type PackageKey,
  type PlanPricing,
} from '@/lib/billing';
import PlanPricingTable from '@/components/PlanPricingTable';
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

  const [pricing, setPricing] = useState<PlanPricing | null>(null);
  const [pricingError, setPricingError] = useState(false);
  const [selectedBand, setSelectedBand] = useState<GuardBand | null>(null);
  const [pending, setPending] = useState<PackageKey | null>(null);
  const [error, setError] = useState('');
  const [changed, setChanged] = useState(false);

  const loadPricing = () =>
    getPlanPricing()
      .then((next) => {
        setPricing(next);
        setPricingError(false);
        // Start on the plan they are on, or else the lowest band they can
        // choose -- never a band below the guards they run.
        setSelectedBand((previous) => {
          const rank = (band: GuardBand) =>
            next.bands.findIndex((entry) => entry.key === band);
          const candidate = previous ?? next.current?.band ?? next.minimumBand;
          return rank(candidate) < rank(next.minimumBand)
            ? next.minimumBand
            : candidate;
        });
      })
      .catch(() => setPricingError(true));

  useEffect(() => {
    void loadPricing();
  }, []);

  const choose = async (packageKey: PackageKey) => {
    if (!pricing || !selectedBand) return;
    setError('');
    setChanged(false);
    setPending(packageKey);
    try {
      const band =
        packageKey === 'GENERATION' ? pricing.generationOnlyBand : selectedBand;
      const result = await startPlanCheckout(packageKey, band);
      if (result.url) {
        window.location.href = result.url;
        return;
      }
      if (result.changed) {
        setChanged(true);
        await loadPricing();
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

      {changed && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
          <Check className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
          <div>
            <p className="font-semibold text-foreground">Plan changed</p>
            <p className="text-sm text-muted-foreground">
              Your subscription has been moved to the new plan, and the
              difference is prorated on your next invoice. Sign out and back in
              if your services have not updated within a minute.
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
              The page you tried to open belongs to {requestedName}. Choose a
              plan that includes it below to enable it for your team.
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

              {!module.active && (
                <a
                  href="#plans"
                  className="mt-5 inline-flex w-full items-center justify-center rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
                >
                  See plans that include it
                </a>
              )}
            </div>
          );
        })}
      </div>

      <section id="plans" className="mt-10 scroll-mt-6">
        <h2 className="text-lg font-semibold text-foreground">
          Plans and pricing
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Priced by the number of active guards you run. Choose the row your
          guard count falls in, then a plan.
        </p>

        {pricingError && (
          <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
            Pricing could not be loaded right now. Refresh the page to try
            again.
          </div>
        )}

        {!pricing && !pricingError && (
          <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
            Loading pricing…
          </div>
        )}

        {pricing && selectedBand && (
          <PlanPricingTable
            pricing={pricing}
            selectedBand={selectedBand}
            onSelectBand={setSelectedBand}
            onChoose={(packageKey) => void choose(packageKey)}
            pending={pending}
          />
        )}
      </section>

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
