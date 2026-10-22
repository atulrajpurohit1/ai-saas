'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import PageHeader from '@/components/PageHeader';
import { useAuth } from '@/context/AuthContext';
import {
  COMPLETE_PACKAGE_LABEL,
  COMPLETE_PACKAGE_TAGLINE,
  SERVICE_MODULE_LABELS,
  ServiceModuleKey,
  moduleSummary,
  subscribedPackage,
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
import {
  BrainCircuit,
  CalendarClock,
  Check,
  DollarSign,
  Layers,
  Lock,
  ShieldCheck,
} from 'lucide-react';

/** Dates here are plan boundaries, so the day is all that matters. */
function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

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

/** Complete is one plan, so it gets one card rather than three. */
const COMPLETE_HIGHLIGHTS = [
  'Everything in AegisLead Generation - prospecting, deals and proposals',
  'Everything in AegisLead Guard - patrols, incidents and compliance',
  'Everything in AegisLead Operations - scheduling, invoicing and finance',
];

/** One card on the "what you have" row. */
interface PlanCard {
  key: string;
  name: string;
  tagline: string;
  blurb: string;
  highlights: string[];
  icon: typeof BrainCircuit;
  active: boolean;
  /** Null for the Complete bundle, which is not a single module. */
  module: ServiceModuleKey | null;
}

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

  /**
   * The cards for "what this account has" -- the plan they are on, and nothing
   * else. Showing all three services here told a Complete customer that two of
   * their own modules were separate products, and told a Generation customer
   * about two they had not bought; the pricing table below is where the rest of
   * the catalogue belongs.
   *
   * Three cases:
   *  - Complete: one card for the bundle, not three for its parts.
   *  - A single service: that service's card.
   *  - Nothing active (lapsed, revoked, or never provisioned): all three, so
   *    the page still explains what is on offer instead of rendering empty.
   */
  const planCards = useMemo<PlanCard[]>(() => {
    const moduleCard = (module: (typeof modules)[number]): PlanCard => ({
      key: module.key,
      name: module.name,
      tagline: module.tagline,
      blurb: module.blurb,
      highlights: MODULE_HIGHLIGHTS[module.key],
      icon: MODULE_ICONS[module.key],
      active: module.active,
      module: module.key,
    });

    if (subscribedPackage(entitlements) === 'COMPLETE') {
      return [
        {
          key: 'COMPLETE',
          name: COMPLETE_PACKAGE_LABEL,
          tagline: COMPLETE_PACKAGE_TAGLINE,
          blurb:
            'Every AegisLead service on one account: lead generation, field ' +
            'operations and the finance that follows them.',
          highlights: COMPLETE_HIGHLIGHTS,
          icon: Layers,
          active: true,
          module: null,
        },
      ];
    }

    const active = modules.filter((module) => module.active);
    return (active.length ? active : modules).map(moduleCard);
  }, [entitlements, modules]);

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

      {/*
        What happens when the paid plan runs out. Shown before the cards so it
        is read alongside them: the cards describe today, this describes next
        month, and "my subscription ended and I still have access" should not
        be a surprise.
      */}
      {entitlements?.pendingPlan && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-border bg-card p-4">
          <CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
          <div>
            <p className="font-semibold text-foreground">
              {entitlements.pendingPlan.name} starts when your current plan ends
            </p>
            <p className="text-sm text-muted-foreground">
              {entitlements.pendingPlan.startsAt
                ? `From ${formatDate(entitlements.pendingPlan.startsAt)}, this account moves onto ${entitlements.pendingPlan.name}.`
                : `When your current plan ends, this account moves onto ${entitlements.pendingPlan.name}.`}{' '}
              {entitlements.pendingPlan.days
                ? `It runs for ${entitlements.pendingPlan.days} day${
                    entitlements.pendingPlan.days === 1 ? '' : 's'
                  } from then.`
                : 'Nothing changes before then.'}
            </p>
          </div>
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

      <div
        className={cn(
          'grid gap-4',
          // A lone card stretched across three columns reads as a banner, so
          // the bundle card is held to a readable width instead.
          planCards.length === 1 ? 'max-w-xl' : 'md:grid-cols-3',
        )}
      >
        {planCards.map((card) => {
          const Icon = card.icon;

          return (
            <div
              key={card.key}
              className={cn(
                'flex flex-col rounded-xl border p-5 transition-colors',
                card.active
                  ? 'border-primary/30 bg-primary/5'
                  : 'border-border bg-card',
                requested === card.module &&
                  !card.active &&
                  'ring-2 ring-amber-500/40',
              )}
            >
              <div className="mb-3 flex items-center justify-between">
                <span
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-lg',
                    card.active
                      ? 'bg-primary/10 text-primary'
                      : 'bg-muted text-muted-foreground',
                  )}
                >
                  <Icon className="h-5 w-5" />
                </span>
                {card.active ? (
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
                {card.name}
                <span className="align-super text-[10px] text-muted-foreground">
                  &trade;
                </span>
              </h3>
              <p className="mt-1 text-sm font-medium text-foreground/80">
                {card.tagline}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">{card.blurb}</p>

              <ul className="mt-4 space-y-2">
                {card.highlights.map((highlight) => (
                  <li
                    key={highlight}
                    className="flex items-start gap-2 text-sm text-muted-foreground"
                  >
                    <Check
                      className={cn(
                        'mt-0.5 h-4 w-4 shrink-0',
                        card.active ? 'text-primary' : 'text-muted-foreground/50',
                      )}
                    />
                    {highlight}
                  </li>
                ))}
              </ul>

              {!card.active && (
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
          Priced by the number of guards on your account. Choose the row your
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
        Want to see how much of this account is in use?{' '}
        <Link href="/settings/billing" className="font-medium text-primary hover:underline">
          View usage
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
