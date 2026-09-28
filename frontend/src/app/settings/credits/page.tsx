'use client';

import React, { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import PageHeader from '@/components/PageHeader';
import { cn } from '@/lib/utils';
import {
  getCreditBalance,
  getCreditLedger,
  getCreditPacks,
  startCreditCheckout,
  type CreditBalance,
  type CreditLedgerEntry,
  type CreditPackAvailability,
} from '@/lib/billing';
import { getApiErrorMessage } from '@/lib/api-error';
import { Check, Clock, Coins, Search } from 'lucide-react';

/** Human label for each ledger row type. */
const ENTRY_LABELS: Record<CreditLedgerEntry['type'], string> = {
  PURCHASE: 'Purchased',
  RESERVATION: 'Search started',
  RELEASE: 'Returned',
  CONSUMPTION: 'Used',
  ADJUSTMENT: 'Adjustment',
};

function formatDate(value: string) {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function CreditsContent() {
  const searchParams = useSearchParams();
  const checkoutState = searchParams.get('checkout');

  const [balance, setBalance] = useState<CreditBalance | null>(null);
  const [packs, setPacks] = useState<CreditPackAvailability | null>(null);
  const [ledger, setLedger] = useState<CreditLedgerEntry[]>([]);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [balanceResult, packsResult, ledgerResult] = await Promise.all([
        getCreditBalance(),
        getCreditPacks(),
        getCreditLedger(25).catch(() => [] as CreditLedgerEntry[]),
      ]);
      setBalance(balanceResult);
      setPacks(packsResult);
      setLedger(ledgerResult);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Unable to load your credit balance.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Stripe redirects back here the moment checkout completes, which can be
  // before the webhook has landed. One delayed refresh covers that gap without
  // making the customer reload the page themselves.
  useEffect(() => {
    if (checkoutState !== 'success') return;
    const timer = setTimeout(() => void load(), 3000);
    return () => clearTimeout(timer);
  }, [checkoutState, load]);

  const buy = async (pack: string) => {
    setError('');
    setPending(pack);
    try {
      const { url } = await startCreditCheckout(pack);
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

  return (
    // Credits only pay for Prospect Search, so a tenant without AegisLead
    // Generation sees the upgrade prompt rather than a buy button for something
    // they could not spend. The backend enforces the same rule.
    <DashboardLayout requiredModule="LEAD_GEN" requiredPermissions="billing.view">
      <PageHeader
        title="Prospect Search credits"
        description="Credits pay for AI prospect research. One credit covers one company playbook, or one prospect found by a discovery search."
      />

      {checkoutState === 'success' && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
          <Check className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
          <div>
            <p className="font-semibold text-foreground">Payment received</p>
            <p className="text-sm text-muted-foreground">
              Your credits are being added. This can take a few seconds.
            </p>
          </div>
        </div>
      )}

      {checkoutState === 'cancelled' && (
        <div className="mb-6 rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
          Checkout was cancelled. Nothing has been charged.
        </div>
      )}

      {error && (
        <div className="mb-6 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-foreground">
          {error}
        </div>
      )}

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-5">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Coins className="h-4 w-4 text-primary" /> Available
          </div>
          <p className="mt-2 text-3xl font-semibold text-foreground">
            {loading ? '—' : (balance?.balance ?? 0).toLocaleString()}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Clock className="h-4 w-4" /> Held by running searches
          </div>
          <p className="mt-2 text-3xl font-semibold text-foreground">
            {loading ? '—' : (balance?.reservedPending ?? 0).toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Returned automatically if a search finds less than expected.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Search className="h-4 w-4" /> Used to date
          </div>
          <p className="mt-2 text-3xl font-semibold text-foreground">
            {loading ? '—' : (balance?.lifetimeConsumed ?? 0).toLocaleString()}
          </p>
        </div>
      </div>

      <h2 className="mb-3 text-lg font-semibold text-foreground">Buy credits</h2>

      {packs && !packs.configured && (
        <div className="mb-6 rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
          Self-serve credit purchase is not switched on for this account yet.
          Contact your account manager to add credits.
        </div>
      )}

      {packs?.configured && packs.packs.length === 0 && (
        <div className="mb-6 rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
          No credit packs are available for purchase right now.
        </div>
      )}

      {packs?.configured && packs.packs.length > 0 && (
        <div className="grid gap-4 md:grid-cols-3">
          {packs.packs.map((pack) => {
            const perCredit = pack.price / pack.credits;

            return (
              <div
                key={pack.key}
                className="flex flex-col rounded-xl border border-border bg-card p-5"
              >
                <h3 className="text-base font-semibold text-foreground">
                  {pack.label}
                </h3>
                <p className="mt-2 text-3xl font-semibold text-foreground">
                  {pack.credits.toLocaleString()}
                  <span className="ml-1 text-sm font-normal text-muted-foreground">
                    credits
                  </span>
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  ${pack.price.toLocaleString()} — ${perCredit.toFixed(2)} per
                  credit
                </p>

                <button
                  type="button"
                  onClick={() => void buy(pack.key)}
                  disabled={pending !== null}
                  className={cn(
                    'mt-5 inline-flex w-full items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-60',
                    'bg-primary text-primary-foreground',
                  )}
                >
                  {pending === pack.key ? 'Starting checkout…' : 'Buy'}
                </button>
              </div>
            );
          })}
        </div>
      )}

      <h2 className="mb-3 mt-10 text-lg font-semibold text-foreground">
        Recent activity
      </h2>

      {ledger.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
          No credit activity yet.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Activity</th>
                <th className="px-4 py-3 font-medium">Detail</th>
                <th className="px-4 py-3 text-right font-medium">Change</th>
                <th className="px-4 py-3 text-right font-medium">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card">
              {ledger.map((entry) => (
                <tr key={entry.id}>
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                    {formatDate(entry.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-foreground">
                    {ENTRY_LABELS[entry.type] ?? entry.type}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {entry.description}
                  </td>
                  <td
                    className={cn(
                      'whitespace-nowrap px-4 py-3 text-right font-medium',
                      entry.amount > 0 && 'text-emerald-600',
                      entry.amount < 0 && 'text-foreground',
                      entry.amount === 0 && 'text-muted-foreground',
                    )}
                  >
                    {entry.amount > 0 ? `+${entry.amount}` : entry.amount}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-muted-foreground">
                    {entry.balanceAfter}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </DashboardLayout>
  );
}

export default function CreditsPage() {
  return (
    <Suspense fallback={null}>
      <CreditsContent />
    </Suspense>
  );
}
