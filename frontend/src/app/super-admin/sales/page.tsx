'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  CalendarDays,
  Loader2,
  Plus,
  Tag,
  Trash2,
} from 'lucide-react';
import { usePlatformAuth } from '@/context/PlatformAuthContext';
import { getApiErrorMessage } from '@/lib/api-error';
import type { PackageKey } from '@/lib/billing';
import {
  createSale,
  deleteSale,
  listSales,
  setSaleEnabled,
  updateSale,
  type SaleCampaign,
  type SaleInput,
} from '@/lib/sales';

const PACKAGES: { key: PackageKey; label: string }[] = [
  { key: 'GENERATION', label: 'Lead Gen' },
  { key: 'GUARD', label: 'Guard' },
  { key: 'OPERATIONS', label: 'Operations' },
  { key: 'COMPLETE', label: 'Complete' },
];

function localInputDate(date: Date): string {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}

function blankForm() {
  const now = new Date();
  return {
    name: '',
    percentOff: 20,
    bonusCredits: 0,
    packageKeys: PACKAGES.map((p) => p.key),
    startsAt: localInputDate(now),
    endsAt: localInputDate(new Date(now.getTime() + 7 * 86400000)),
    enabled: true,
  };
}

type Form = ReturnType<typeof blankForm>;

const fieldClass =
  'mt-1 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary';

export default function SalesPage() {
  const { admin, loading: authLoading } = usePlatformAuth();
  const router = useRouter();
  const [sales, setSales] = useState<SaleCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(blankForm);

  const refresh = useCallback(async () => {
    try {
      setSales(await listSales());
      setError('');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not load sales.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!admin) {
      router.replace('/super-admin/login');
      return;
    }
    void refresh();
  }, [admin, authLoading, refresh, router]);

  const edit = (sale: SaleCampaign) => {
    setEditingId(sale.id);
    setForm({
      name: sale.name,
      percentOff: sale.percentOff,
      bonusCredits: sale.bonusCredits,
      packageKeys: sale.packageKeys,
      startsAt: localInputDate(new Date(sale.startsAt)),
      endsAt: localInputDate(new Date(sale.endsAt)),
      enabled: sale.enabled,
    });
    setError('');
    document
      .getElementById('sale-form')
      ?.scrollIntoView({ behavior: 'smooth' });
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setNotice('');
    if (form.packageKeys.length === 0) {
      setError('Choose at least one plan.');
      return;
    }
    if (form.percentOff === 0 && form.bonusCredits === 0) {
      setError('Add a discount or bonus credits.');
      return;
    }
    const input: SaleInput = {
      ...form,
      name: form.name.trim(),
      startsAt: new Date(form.startsAt).toISOString(),
      endsAt: new Date(form.endsAt).toISOString(),
    };
    setBusy(true);
    try {
      if (editingId) await updateSale(editingId, input);
      else await createSale(input);
      setNotice(
        editingId
          ? 'Sale updated.'
          : 'Sale created. It will start automatically at the scheduled time.',
      );
      setEditingId(null);
      setForm(blankForm());
      await refresh();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not save the sale.'));
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (sale: SaleCampaign) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await setSaleEnabled(sale.id, !sale.enabled);
      setNotice(sale.enabled ? 'Sale paused.' : 'Sale enabled.');
      await refresh();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not change the sale.'));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (sale: SaleCampaign) => {
    if (
      !window.confirm(
        `Delete “${sale.name}”? New checkouts will stop receiving this offer.`,
      )
    )
      return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await deleteSale(sale.id);
      if (editingId === sale.id) {
        setEditingId(null);
        setForm(blankForm());
      }
      setNotice('Sale deleted.');
      await refresh();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not delete the sale.'));
    } finally {
      setBusy(false);
    }
  };

  if (authLoading || !admin)
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-4 sm:px-6">
          <Link
            href="/super-admin"
            className="rounded-lg border border-border p-2 hover:bg-muted"
            aria-label="Back to platform overview"
          >
            <ArrowLeft size={18} />
          </Link>
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Tag size={18} />
          </span>
          <div>
            <div className="font-bold">Sales & offers</div>
            <div className="text-xs text-muted-foreground">
              Platform control
            </div>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-bold">Festival sales</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Schedule a first-invoice discount, bonus credits, or both for new plan
          subscriptions. Regular monthly pricing applies afterward. Existing
          subscriptions and credit packs are unaffected. If offers overlap on
          one plan, the highest discount wins; bonus credits break a tie.
        </p>
        {error && (
          <div
            role="alert"
            className="mt-5 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-600"
          >
            {error}
          </div>
        )}
        {notice && (
          <div
            role="status"
            className="mt-5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700"
          >
            {notice}
          </div>
        )}
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,370px)_1fr]">
          <form
            id="sale-form"
            onSubmit={(e) => void save(e)}
            className="h-fit rounded-xl border border-border bg-card p-5 shadow-sm"
          >
            <h2 className="flex items-center gap-2 font-semibold">
              <Plus size={17} className="text-primary" />{' '}
              {editingId ? 'Edit sale' : 'Create sale'}
            </h2>
            <label className="mt-5 block text-sm font-medium">
              Sale name
              <input
                required
                maxLength={100}
                minLength={2}
                className={fieldClass}
                placeholder="Black Friday"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>
            <label className="mt-4 block text-sm font-medium">
              Discount on first invoice (%)
              <input
                required
                type="number"
                min={0}
                max={100}
                step={1}
                className={fieldClass}
                value={form.percentOff}
                onChange={(e) =>
                  setForm({ ...form, percentOff: Number(e.target.value) })
                }
              />
            </label>
            <label className="mt-4 block text-sm font-medium">
              Bonus credits for new subscribers
              <input
                required
                type="number"
                min={0}
                max={1000000}
                step={1}
                className={fieldClass}
                value={form.bonusCredits}
                onChange={(e) =>
                  setForm({ ...form, bonusCredits: Number(e.target.value) })
                }
              />
              <span className="mt-1 block text-xs text-muted-foreground">
                Granted once to first-time paid subscribers after their first
                invoice is paid. Set the discount to 0 for a credits-only offer.
              </span>
            </label>
            <fieldset className="mt-4">
              <legend className="text-sm font-medium">Eligible plans</legend>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {PACKAGES.map((pkg) => (
                  <label
                    key={pkg.key}
                    className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      className="accent-[var(--primary)]"
                      checked={form.packageKeys.includes(pkg.key)}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          packageKeys: e.target.checked
                            ? [...form.packageKeys, pkg.key]
                            : form.packageKeys.filter((key) => key !== pkg.key),
                        })
                      }
                    />
                    {pkg.label}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="mt-4 block text-sm font-medium">
              Starts at
              <input
                required
                type="datetime-local"
                className={fieldClass}
                value={form.startsAt}
                onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
              />
            </label>
            <label className="mt-4 block text-sm font-medium">
              Ends at
              <input
                required
                type="datetime-local"
                className={fieldClass}
                value={form.endsAt}
                onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
              />
            </label>
            <p className="mt-2 text-xs text-muted-foreground">
              Times use your browser’s time zone and are saved as exact
              instants.
            </p>
            <label className="mt-4 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="accent-[var(--primary)]"
                checked={form.enabled}
                onChange={(e) =>
                  setForm({ ...form, enabled: e.target.checked })
                }
              />
              Enabled
            </label>
            <div className="mt-5 flex gap-2">
              <button
                disabled={busy}
                type="submit"
                className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
              >
                {busy ? 'Saving…' : editingId ? 'Save changes' : 'Create sale'}
              </button>
              {editingId && (
                <button
                  type="button"
                  className="rounded-lg border border-border px-4 py-2.5 text-sm"
                  onClick={() => {
                    setEditingId(null);
                    setForm(blankForm());
                  }}
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
          <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h2 className="flex items-center gap-2 font-semibold">
              <CalendarDays size={17} className="text-primary" /> Scheduled and
              past sales
            </h2>
            {loading ? (
              <p className="mt-5 text-sm text-muted-foreground">
                Loading sales…
              </p>
            ) : sales.length === 0 ? (
              <p className="mt-5 text-sm text-muted-foreground">
                No sales yet. Create one to schedule your first offer.
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {sales.map((sale) => {
                  const now = Date.now();
                  const status = !sale.enabled
                    ? 'Paused'
                    : new Date(sale.endsAt).getTime() <= now
                      ? 'Ended'
                      : new Date(sale.startsAt).getTime() > now
                        ? 'Scheduled'
                        : 'Live';
                  return (
                    <article
                      key={sale.id}
                      className="rounded-lg border border-border p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="font-semibold">
                            {sale.name}{' '}
                            <span className="ml-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                              {sale.percentOff > 0
                                ? `${sale.percentOff}% off`
                                : 'No discount'}
                            </span>
                            {sale.bonusCredits > 0 && (
                              <span className="ml-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-700">
                                +{sale.bonusCredits.toLocaleString()} credits
                              </span>
                            )}
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {sale.packageKeys
                              .map(
                                (key) =>
                                  PACKAGES.find((p) => p.key === key)?.label,
                              )
                              .join(', ')}
                          </div>
                        </div>
                        <span className="rounded-full bg-muted px-2 py-1 text-xs font-semibold">
                          {status}
                        </span>
                      </div>
                      <div className="mt-3 text-xs text-muted-foreground">
                        {new Date(sale.startsAt).toLocaleString()} –{' '}
                        {new Date(sale.endsAt).toLocaleString()}
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          disabled={busy}
                          onClick={() => edit(sale)}
                          className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted"
                        >
                          Edit
                        </button>
                        <button
                          disabled={busy}
                          onClick={() => void toggle(sale)}
                          className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted"
                        >
                          {sale.enabled ? 'Pause' : 'Enable'}
                        </button>
                        <button
                          disabled={busy}
                          onClick={() => void remove(sale)}
                          className="inline-flex items-center gap-1 rounded-lg border border-red-500/30 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-500/10"
                        >
                          <Trash2 size={12} /> Delete
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
