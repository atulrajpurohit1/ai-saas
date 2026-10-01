'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import type { GuardBand, PackageKey, PlanPricing } from '@/lib/billing';

const PACKAGE_TAGLINES: Record<PackageKey, string> = {
  GENERATION: 'Find the opportunity. Know the buyer. Execute the sale.',
  GUARD: 'Manage field operations, guard tours and accountability.',
  OPERATIONS: 'Scheduling, workforce management, finance and profitability.',
  COMPLETE: 'One platform. From opportunity to operation to revenue.',
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

  // Generation on its own is charged at the base band whatever the headcount.
  const chargedBand = (packageKey: PackageKey) =>
    packageKey === 'GENERATION' ? pricing.generationOnlyBand : selectedBand;

  const renderAction = (pkg: PlanPricing['packages'][number]) => {
    const band = chargedBand(pkg.key);
    const amount = pkg.monthly[band];
    const isCurrent =
      pricing.current?.packageKey === pkg.key &&
      (pkg.key === 'GENERATION' || pricing.current.band === band);
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
                Active guards
              </th>
              {pricing.packages.map((pkg) => (
                <th
                  key={pkg.key}
                  className={cn(
                    'p-4 text-center align-top font-normal',
                    pkg.key === 'COMPLETE' && 'bg-primary/5',
                  )}
                >
                  {pkg.key === 'COMPLETE' && (
                    <span className="mb-2 inline-block rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-semibold text-primary-foreground">
                      Most popular
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
                  {pricing.packages.map((pkg) => {
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
              {pricing.packages.map((pkg) => (
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
          Active guards are guards rostered on a shift in the last 30 days. Your
          account runs {pricing.activeGuards}, so the lowest band you can choose
          is {bandLabel(pricing.minimumBand)}.
        </p>
        <p>
          AegisLead Generation on its own is{' '}
          {money(
            pricing.packages.find((pkg) => pkg.key === 'GENERATION')?.monthly[
              pricing.generationOnlyBand
            ] ?? 0,
          )}
          /mo at any guard count.
        </p>
      </div>
    </div>
  );
}
