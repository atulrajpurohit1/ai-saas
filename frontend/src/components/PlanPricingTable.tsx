'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import type { GuardBand, PackageKey, PlanPricing } from '@/lib/billing';

/**
 * GENERATION is still listed: a package that is no longer sold by band can
 * still be the plan a tenant is on, and an older backend may still send it as
 * a column. It is not expected in this table any more -- Lead Gen is sold as
 * flat tiers above it, by LeadGenPlans.
 *
 * Guard and Operations say what they ADD, not "everything in the one before
 * it". The packages are not a ladder: PACKAGE_MODULES gives Guard only
 * GUARD_TOUR and Operations only FINANCE, so a Guard customer told they had
 * "everything in Lead Gen" would click Prospect Search and hit a locked
 * screen. Only Complete may claim the others, because only Complete actually
 * grants all three modules.
 */
const PACKAGE_TAGLINES: Record<PackageKey, string> = {
  GENERATION: 'Find the opportunity. Know the buyer. Execute the sale.',
  GUARD: 'Adds field operations: patrols, checkpoint evidence, incidents and guard accountability.',
  OPERATIONS:
    'Adds the back office: scheduling, workforce management, invoicing and profitability.',
  COMPLETE: 'Everything in Lead Gen, Guard and Operations, on one account.',
};

const SALES_EMAIL = 'sales@aegislead.com';

const bandLabel = (band: GuardBand) => band.replace('-', '–');

const money = (amount: number) => `$${amount.toLocaleString('en-US')}`;

interface Props {
  pricing: PlanPricing;
  selectedBand: GuardBand;
  onSelectBand: (band: GuardBand) => void;
  onChoose: (packageKey: PackageKey) => void;
  pending: PackageKey | null;
}

/**
 * The published price table, by active guards and package. The customer picks
 * the row their guard count falls in; rows below the guards they actually run
 * cannot be picked, and the server refuses them too.
 */
export default function PlanPricingTable({
  pricing,
  selectedBand,
  onSelectBand,
  onChoose,
  pending,
}: Props) {
  const rank = (band: GuardBand) =>
    pricing.bands.findIndex((entry) => entry.key === band);
  const minimumRank = rank(pricing.minimumBand);

  // Lead Gen is not priced by guards and is sold above this chart, so it is
  // never a column here -- filtered rather than assumed, because an older
  // backend still sends it.
  const packages = pricing.packages.filter((pkg) => pkg.key !== 'GENERATION');

  const renderAction = (pkg: PlanPricing['packages'][number]) => {
    const band = selectedBand;
    const amount = pkg.monthly[band];
    const isCurrent =
      pricing.current?.packageKey === pkg.key &&
      pricing.current.band === band;
    const sellable =
      pricing.configured && amount !== null && pkg.sellableBands.includes(band);

    if (isCurrent) {
      return (
        <span className="inline-flex w-full items-center justify-center rounded-lg border border-primary/40 px-3 py-2 text-sm font-semibold text-primary">
          Current plan
        </span>
      );
    }

    if (!sellable) {
      return (
        <a
          href={`mailto:${SALES_EMAIL}?subject=${encodeURIComponent(
            `${pkg.name} for ${bandLabel(band)} guards`,
          )}`}
          className="inline-flex w-full items-center justify-center rounded-lg border border-border px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
        >
          Contact sales
        </a>
      );
    }

    return (
      <button
        type="button"
        onClick={() => onChoose(pkg.key)}
        disabled={pending !== null}
        className="inline-flex w-full items-center justify-center rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {pending === pkg.key
          ? 'Redirecting…'
          : `${pricing.current ? 'Switch' : 'Get started'} · ${money(amount)}/mo`}
      </button>
    );
  };

  return (
    <div>
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <thead>
            <tr>
              <th className="w-36 p-4 text-left align-bottom text-sm font-semibold text-primary">
                Guards
              </th>
              {packages.map((pkg) => (
                <th
                  key={pkg.key}
                  className={cn(
                    'p-4 text-center align-top font-normal',
                    pkg.key === 'COMPLETE' && 'bg-primary/5',
                  )}
                >
                  {pkg.key === 'COMPLETE' && (
                    <span className="mb-2 inline-block rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-semibold text-primary-foreground">
                      Top Selection
                    </span>
                  )}
                  <div className="text-base font-semibold text-primary">
                    {pkg.name}
                    <span className="align-super text-[10px]">&trade;</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {PACKAGE_TAGLINES[pkg.key]}
                  </p>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pricing.bands.map((band) => {
              const belowMinimum = rank(band.key) < minimumRank;
              const selected = band.key === selectedBand;

              return (
                <tr
                  key={band.key}
                  className={cn(
                    'border-t border-border',
                    selected && 'bg-primary/5',
                    belowMinimum && 'opacity-50',
                  )}
                >
                  <td className="p-0">
                    <label
                      className={cn(
                        'flex items-center gap-2 px-4 py-3 font-medium text-foreground',
                        belowMinimum ? 'cursor-not-allowed' : 'cursor-pointer',
                      )}
                    >
                      <input
                        type="radio"
                        name="guard-band"
                        value={band.key}
                        checked={selected}
                        disabled={belowMinimum}
                        onChange={() => onSelectBand(band.key)}
                        className="accent-[var(--primary)]"
                      />
                      {bandLabel(band.key)}
                    </label>
                  </td>
                  {packages.map((pkg) => {
                    const amount = pkg.monthly[band.key];
                    return (
                      <td
                        key={pkg.key}
                        className={cn(
                          'px-4 py-3 text-center text-foreground',
                          pkg.key === 'COMPLETE' && 'bg-primary/5 font-semibold',
                        )}
                      >
                        {amount === null ? (
                          <span className="font-medium">Custom</span>
                        ) : (
                          <>
                            <span className="font-semibold">{money(amount)}</span>
                            <span className="text-muted-foreground">/mo</span>
                          </>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            <tr className="border-t border-border">
              <td className="p-4 text-xs text-muted-foreground">
                For {bandLabel(selectedBand)} guards
              </td>
              {packages.map((pkg) => (
                <td
                  key={pkg.key}
                  className={cn('p-4', pkg.key === 'COMPLETE' && 'bg-primary/5')}
                >
                  {renderAction(pkg)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-3 space-y-1 text-xs text-muted-foreground">
        <p>
          Every guard added to your account is billed for the full month, even
          if they leave part-way through. Deactivate a guard who has left and
          they stop counting from the following month. Your account has{' '}
          {pricing.billableGuards}, so the lowest band you can choose is{' '}
          {bandLabel(pricing.minimumBand)}.
        </p>
        <p>
          AegisLead Complete includes Lead Gen. The monthly credits are part of
          the Lead Gen plans above; on Complete, credits are bought separately
          from the credits page.
        </p>
      </div>
    </div>
  );
}
