'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  attachAutoRechargeCard,
  getAutoRecharge,
  getAutoRechargeAttempts,
  resumeAutoRecharge,
  startAutoRechargeCardSetup,
  updateAutoRecharge,
  type AutoRechargeAttempt,
  type AutoRechargeSettings,
} from '@/lib/billing';
import { getApiErrorMessage } from '@/lib/api-error';
import {
  AlertTriangle,
  CreditCard,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';

/**
 * Auto-recharge settings.
 *
 * This screen authorises charges to a saved card while nobody is watching, so
 * it states the limits in plain words rather than only accepting them as
 * numbers: what will be bought, at what balance, and the most that can be
 * spent in a month. Every guard shown here is enforced server-side too -- this
 * is the explanation, not the enforcement.
 */

const STATUS_LABELS: Record<AutoRechargeAttempt['status'], string> = {
  SUCCEEDED: 'Topped up',
  FAILED: 'Failed',
  SKIPPED: 'Skipped',
};

const PAUSE_REASONS: Record<string, string> = {
  PAYMENT_FAILED:
    'Your saved card was declined three times in a row, so automatic top-ups were paused. Save a working card to start them again.',
  MONTHLY_CAP_REACHED:
    'This month’s spending cap has been reached. Top-ups resume at the start of next month, or raise the cap below.',
};

function formatDate(value: string) {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export default function AutoRechargeCard({
  /** Signals from the Stripe card-setup redirect, read by the parent page. */
  cardSetupState,
  cardSetupSessionId,
  /** Called after a balance-changing action so the parent can refresh. */
  onChanged,
}: {
  cardSetupState?: string | null;
  cardSetupSessionId?: string | null;
  onChanged?: () => void;
}) {
  const [settings, setSettings] = useState<AutoRechargeSettings | null>(null);
  const [attempts, setAttempts] = useState<AutoRechargeAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Form state, kept separate from `settings` so a failed save does not leave
  // the inputs showing values the server rejected.
  const [threshold, setThreshold] = useState(25);
  const [packKey, setPackKey] = useState('');
  const [capEnabled, setCapEnabled] = useState(true);
  const [cap, setCap] = useState<number | ''>('');

  const applySettings = useCallback((next: AutoRechargeSettings) => {
    setSettings(next);
    const firstPack = next.packs[0]?.key ?? '';
    setThreshold(next.thresholdCredits ?? 25);
    setPackKey(next.packKey ?? firstPack);
    setCapEnabled(
      next.monthlyCapAmount !== null && next.monthlyCapAmount !== undefined,
    );
    setCap(next.monthlyCapAmount ?? '');
  }, []);

  const load = useCallback(async () => {
    try {
      const next = await getAutoRecharge();
      applySettings(next);
      // Attempt history is only meaningful once something has been configured,
      // and the endpoint is permission-gated the same way, so a failure here
      // must not blank the whole card.
      if (next.configured) {
        setAttempts(await getAutoRechargeAttempts(10).catch(() => []));
      }
    } catch (err) {
      setError(
        getApiErrorMessage(err, 'Unable to load your auto top-up settings.'),
      );
    } finally {
      setLoading(false);
    }
  }, [applySettings]);

  useEffect(() => {
    void load();
  }, [load]);

  // Stripe returns from the hosted card form with the setup session id. No
  // webhook records a `setup` session, so posting it back here is the only
  // thing that actually saves the card.
  useEffect(() => {
    if (cardSetupState !== 'success' || !cardSetupSessionId) return;
    let cancelled = false;
    (async () => {
      setBusy('card');
      try {
        await attachAutoRechargeCard(cardSetupSessionId);
        if (cancelled) return;
        setNotice('Card saved. Automatic top-ups can now be charged to it.');
        await load();
        onChanged?.();
      } catch (err) {
        if (cancelled) return;
        setError(getApiErrorMessage(err, 'Unable to save that card.'));
      } finally {
        if (!cancelled) setBusy(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cardSetupState, cardSetupSessionId, load, onChanged]);

  const selectedPack = settings?.packs.find((p) => p.key === packKey);

  const save = async (nextEnabled: boolean) => {
    setError('');
    setNotice('');

    // Guard the two rules the service enforces, so a mistake reads as help
    // rather than as a 400 from the API.
    if (nextEnabled && !packKey) {
      setError('Choose which credit pack to buy.');
      return;
    }
    if (nextEnabled && selectedPack && threshold >= selectedPack.credits) {
      setError(
        `The trigger balance must be below the pack size (${selectedPack.credits.toLocaleString()} credits), or a top-up would trigger again immediately.`,
      );
      return;
    }
    const capValue = capEnabled && cap !== '' ? Number(cap) : null;
    if (nextEnabled && capEnabled && capValue === null) {
      setError('Enter a monthly spending cap, or turn the cap off.');
      return;
    }
    if (
      nextEnabled &&
      capValue !== null &&
      selectedPack &&
      capValue < selectedPack.price
    ) {
      setError(
        `The monthly cap must be at least $${selectedPack.price}, the price of one ${selectedPack.label}.`,
      );
      return;
    }

    setSaving(true);
    try {
      await updateAutoRecharge({
        enabled: nextEnabled,
        thresholdCredits: threshold,
        packKey,
        monthlyCapAmount: capValue,
      });
      setNotice(
        nextEnabled
          ? 'Automatic top-ups are on.'
          : 'Automatic top-ups are off. Nothing will be charged.',
      );
      await load();
      onChanged?.();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Unable to save those settings.'));
    } finally {
      setSaving(false);
    }
  };

  const addCard = async () => {
    setError('');
    setBusy('card');
    try {
      const { url } = await startAutoRechargeCardSetup();
      if (url) {
        window.location.href = url;
        return;
      }
      setError('Stripe did not return a card form link. Please try again.');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Unable to start the card form.'));
    } finally {
      setBusy(null);
    }
  };

  const resume = async () => {
    setError('');
    setBusy('resume');
    try {
      await resumeAutoRecharge();
      setNotice('Automatic top-ups resumed.');
      await load();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Unable to resume automatic top-ups.'));
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading automatic top-up
          settings…
        </div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">
        {error || 'Automatic top-up settings are unavailable.'}
      </div>
    );
  }

  const hasCard = !!settings.hasCard;
  const isPaused = !!settings.paused;

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <RefreshCw className="h-5 w-5 text-primary" />
            Automatic top-ups
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Buy more credits automatically when your balance runs low, so a
            search never fails for want of credits. Off by default — nothing is
            charged until you turn this on and save a card.
          </p>
        </div>

        <span
          className={cn(
            'rounded-full px-3 py-1 text-xs font-semibold',
            isPaused
              ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
              : settings.enabled && hasCard
                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                : 'bg-muted text-muted-foreground',
          )}
        >
          {isPaused
            ? 'Paused'
            : settings.enabled && hasCard
              ? 'On'
              : settings.enabled
                ? 'Needs a card'
                : 'Off'}
        </span>
      </div>

      {notice && (
        <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-foreground">
          {notice}
        </div>
      )}

      {cardSetupState === 'cancelled' && !notice && (
        <div className="mt-4 rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
          Card setup was cancelled. No card was saved and nothing was charged.
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-foreground">
          {error}
        </div>
      )}

      {isPaused && (
        <div className="mt-4 flex flex-wrap items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div className="flex-1">
            <p className="font-semibold text-foreground">
              Automatic top-ups are paused
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {(settings.pauseReason &&
                PAUSE_REASONS[settings.pauseReason]) ||
                'Automatic top-ups stopped themselves. Review the settings below.'}
            </p>
            {settings.pausedAt && (
              <p className="mt-1 text-xs text-muted-foreground">
                Paused {formatDate(settings.pausedAt)}
              </p>
            )}
            <button
              type="button"
              onClick={() => void resume()}
              disabled={busy !== null}
              className="mt-3 inline-flex items-center justify-center rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold text-foreground hover:opacity-90 disabled:opacity-60"
            >
              {busy === 'resume' && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Resume top-ups
            </button>
          </div>
        </div>
      )}

      {/* --- Saved card --- */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-background/60 p-4">
        <div className="flex items-center gap-3">
          <CreditCard className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium text-foreground">
              {hasCard
                ? `${settings.card?.brand ?? 'Card'} ending ${settings.card?.last4 ?? '••••'}`
                : 'No card saved'}
            </p>
            <p className="text-xs text-muted-foreground">
              {hasCard
                ? 'Charged only when your balance falls to the trigger below.'
                : 'Saving a card authorises future top-ups. It is not charged now.'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void addCard()}
          disabled={busy !== null}
          className="inline-flex items-center justify-center rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold text-foreground hover:opacity-90 disabled:opacity-60"
        >
          {busy === 'card' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {hasCard ? 'Replace card' : 'Save a card'}
        </button>
      </div>

      {/* --- Settings --- */}
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium text-foreground">
            Top up when my balance falls to
          </span>
          <div className="mt-1 flex items-center gap-2">
            <input
              type="number"
              min={1}
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              className="w-32 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
            <span className="text-sm text-muted-foreground">credits</span>
          </div>
        </label>

        <label className="block">
          <span className="text-sm font-medium text-foreground">Then buy</span>
          <select
            value={packKey}
            onChange={(e) => setPackKey(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
          >
            {settings.packs.map((pack) => (
              <option key={pack.key} value={pack.key}>
                {pack.label} — {pack.credits.toLocaleString()} credits for $
                {pack.price.toLocaleString()}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-4 rounded-lg border border-border bg-background/60 p-4">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={capEnabled}
            onChange={(e) => setCapEnabled(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-border"
          />
          <span>
            <span className="text-sm font-medium text-foreground">
              Limit automatic spending to a monthly cap
            </span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              Strongly recommended. Nobody is watching when a top-up fires, so a
              cap is the only hard ceiling on what can be charged in a month.
            </span>
          </span>
        </label>

        {capEnabled && (
          <div className="mt-3 flex items-center gap-2 pl-7">
            <span className="text-sm text-muted-foreground">$</span>
            <input
              type="number"
              min={selectedPack?.price ?? 1}
              value={cap}
              placeholder={String(selectedPack?.price ?? 100)}
              onChange={(e) =>
                setCap(e.target.value === '' ? '' : Number(e.target.value))
              }
              className="w-32 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
            <span className="text-sm text-muted-foreground">per month</span>
          </div>
        )}

        {settings.configured && settings.monthlySpend !== undefined && (
          <p className="mt-3 pl-7 text-xs text-muted-foreground">
            Spent automatically this month:{' '}
            <span className="font-medium text-foreground">
              ${settings.monthlySpend.toLocaleString()}
            </span>
            {settings.monthlyCapAmount
              ? ` of $${settings.monthlyCapAmount.toLocaleString()}`
              : ' (no cap set)'}
          </p>
        )}
      </div>

      {/* Plain-words restatement of what the numbers above authorise. */}
      {selectedPack && (
        <div className="mt-4 flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <p className="text-sm text-foreground">
            When your balance falls to{' '}
            <strong>{threshold.toLocaleString()} credits</strong>, we will charge
            your saved card <strong>${selectedPack.price.toLocaleString()}</strong>{' '}
            for the {selectedPack.label} (
            {selectedPack.credits.toLocaleString()} credits)
            {capEnabled && cap !== ''
              ? `, up to $${Number(cap).toLocaleString()} per month`
              : ''}
            . Top-ups are at least 10 minutes apart, and pause automatically
            after three declines.
          </p>
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void save(true)}
          disabled={saving || busy !== null}
          className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {settings.enabled ? 'Save changes' : 'Turn on automatic top-ups'}
        </button>

        {settings.enabled && (
          <button
            type="button"
            onClick={() => void save(false)}
            disabled={saving || busy !== null}
            className="inline-flex items-center justify-center rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground hover:opacity-90 disabled:opacity-60"
          >
            Turn off
          </button>
        )}

        {!hasCard && (
          <span className="text-xs text-muted-foreground">
            A saved card is needed before any top-up can be charged.
          </span>
        )}
      </div>

      {/* --- History --- */}
      {attempts.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-2 text-sm font-semibold text-foreground">
            Recent automatic top-ups
          </h3>
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">When</th>
                  <th className="px-3 py-2 font-medium">Result</th>
                  <th className="px-3 py-2 font-medium">Charged</th>
                  <th className="px-3 py-2 font-medium">Credits</th>
                  <th className="px-3 py-2 font-medium">Detail</th>
                </tr>
              </thead>
              <tbody>
                {attempts.map((attempt) => (
                  <tr key={attempt.id} className="border-t border-border">
                    <td className="px-3 py-2 text-muted-foreground">
                      {formatDate(attempt.createdAt)}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={cn(
                          'font-medium',
                          attempt.status === 'SUCCEEDED'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : attempt.status === 'FAILED'
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-muted-foreground',
                        )}
                      >
                        {STATUS_LABELS[attempt.status]}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {attempt.amountCharged !== null
                        ? `$${attempt.amountCharged.toLocaleString()}`
                        : '—'}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {attempt.creditsGranted !== null
                        ? attempt.creditsGranted.toLocaleString()
                        : '—'}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {attempt.failureReason ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
