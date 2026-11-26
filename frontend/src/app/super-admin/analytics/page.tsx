'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { usePlatformAuth } from '@/context/PlatformAuthContext';
import { getApiErrorMessage } from '@/lib/api-error';
import { formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import {
  CREDIT_CHANNEL_LABELS,
  type AnalyticsMonth,
  type CreditChannel,
  type PlatformAnalytics,
  getAnalytics,
} from '@/lib/platform';
import {
  ChartCard,
  Legend,
  MonthlyBarChart,
  RankedBars,
  SegmentedBar,
  type Series,
  compact,
  monthLong,
  usd,
} from './charts';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Building2,
  Clock3,
  Coins,
  CreditCard,
  Download,
  Gift,
  Info,
  LayoutDashboard,
  Loader2,
  LockKeyhole,
  LogOut,
  Minus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Table2,
  Users,
} from 'lucide-react';

const RANGES = [6, 12, 24] as const;
type Range = (typeof RANGES)[number];

/**
 * Whether a rise in a metric is good, bad, or neither.
 *
 * Needed because a delta arrow cannot be coloured by direction alone: AI cost
 * climbing 40% is not the same kind of news as signups climbing 40%, and
 * painting both green would misreport the month.
 */
type Polarity = 'up-good' | 'up-bad' | 'neutral';

interface CardSpec {
  key: string;
  label: string;
  value: (row: AnalyticsMonth) => number;
  format?: (value: number) => string;
  polarity: Polarity;
  hint?: string;
}

/**
 * Month-over-month comparison cards.
 *
 * Deliberately the sold/used/earned measures rather than everything the API
 * returns -- the full set lives in the record table below, and a wall of
 * thirty tiles is not a comparison.
 */
const COMPARISON_CARDS: CardSpec[] = [
  {
    key: 'tenants',
    label: 'New accounts',
    value: (r) => r.newTenants,
    polarity: 'up-good',
  },
  {
    key: 'users',
    label: 'New users',
    value: (r) => r.newUsers,
    polarity: 'up-good',
  },
  {
    key: 'modules',
    label: 'Modules activated',
    value: (r) => r.moduleActivations,
    polarity: 'up-good',
    hint: 'first activation',
  },
  {
    key: 'planRevenue',
    label: 'Plan revenue',
    value: (r) => r.planRevenueUsd,
    format: (v) => usd(v, 0),
    polarity: 'up-good',
    hint: 'paid Stripe invoices',
  },
  {
    key: 'planPayments',
    label: 'Plan payments',
    value: (r) => r.planPayments,
    polarity: 'up-good',
  },
  {
    key: 'creditsBought',
    label: 'Credits purchased',
    value: (r) => r.creditsPurchased,
    polarity: 'up-good',
  },
  {
    key: 'revenue',
    label: 'Credit revenue',
    value: (r) => r.creditRevenueUsd,
    format: (v) => usd(v, 0),
    polarity: 'up-good',
    hint: 'List price',
  },
  {
    key: 'creditsUsed',
    label: 'Credits consumed',
    value: (r) => r.creditsConsumed,
    polarity: 'neutral',
  },
  {
    key: 'searches',
    label: 'Searches run',
    value: (r) => r.searchesSettled,
    polarity: 'up-good',
  },
  {
    key: 'tokens',
    label: 'AI tokens used',
    value: (r) => r.aiTotalTokens,
    polarity: 'neutral',
  },
  {
    key: 'aiCalls',
    label: 'AI calls',
    value: (r) => r.aiCalls,
    polarity: 'neutral',
  },
  {
    key: 'aiCost',
    label: 'AI cost',
    value: (r) => r.aiCostUsd,
    format: (v) => usd(v, 2),
    polarity: 'up-bad',
  },
  {
    key: 'upstream',
    label: 'Search cost (upstream)',
    value: (r) => r.upstreamCostUsd,
    format: (v) => usd(v, 2),
    polarity: 'up-bad',
  },
  {
    key: 'rechargeFailed',
    label: 'Failed top-ups',
    value: (r) => r.rechargeFailed,
    polarity: 'up-bad',
  },
];

function deltaPercent(current: number, previous: number): number | null {
  // A rise from nothing has no meaningful percentage -- "+∞%" is noise, so
  // the card shows the absolute change instead.
  if (previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function ComparisonCard({
  label,
  current,
  previous,
  format,
  polarity,
  hint,
}: {
  label: string;
  current: number;
  previous: number;
  format: (value: number) => string;
  polarity: Polarity;
  hint?: string;
}) {
  const change = current - previous;
  const pct = deltaPercent(current, previous);
  const flat = change === 0;

  const good =
    polarity === 'neutral' || flat
      ? null
      : polarity === 'up-good'
        ? change > 0
        : change < 0;

  const Icon = flat ? Minus : change > 0 ? ArrowUpRight : ArrowDownRight;

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-1.5 text-2xl font-bold tabular-nums text-foreground">
        {format(current)}
      </div>
      <div className="mt-1 flex items-center gap-1.5 text-xs">
        <Icon
          className={cn(
            'h-3.5 w-3.5 shrink-0',
            good === null
              ? 'text-muted-foreground'
              : good
                ? 'text-emerald-600'
                : 'text-error',
          )}
        />
        <span
          className={cn(
            'font-medium tabular-nums',
            good === null
              ? 'text-muted-foreground'
              : good
                ? 'text-emerald-600'
                : 'text-error',
          )}
        >
          {flat
            ? 'no change'
            : pct === null
              ? `${change > 0 ? '+' : ''}${format(change)}`
              : `${pct > 0 ? '+' : ''}${pct.toFixed(0)}%`}
        </span>
        <span className="truncate text-muted-foreground">
          vs {hint ? `last month · ${hint}` : 'last month'}
        </span>
      </div>
    </div>
  );
}

/** Every column of the monthly record, in the order the table prints them. */
const RECORD_COLUMNS: {
  key: string;
  label: string;
  value: (r: AnalyticsMonth) => number;
  money?: boolean;
}[] = [
  { key: 'newTenants', label: 'New accounts', value: (r) => r.newTenants },
  { key: 'newUsers', label: 'New users', value: (r) => r.newUsers },
  {
    key: 'moduleActivations',
    label: 'Modules activated',
    value: (r) => r.moduleActivations,
  },
  {
    key: 'planRevenueUsd',
    label: 'Plan revenue',
    value: (r) => r.planRevenueUsd,
    money: true,
  },
  { key: 'planPayments', label: 'Plan payments', value: (r) => r.planPayments },
  {
    key: 'newPlanPayments',
    label: 'New subscription payments',
    value: (r) => r.newPlanPayments,
  },
  {
    key: 'renewalPayments',
    label: 'Renewal payments',
    value: (r) => r.renewalPayments,
  },
  {
    key: 'creditPurchases',
    label: 'Credit purchases',
    value: (r) => r.creditPurchases,
  },
  {
    key: 'creditsPurchased',
    label: 'Credits purchased',
    value: (r) => r.creditsPurchased,
  },
  {
    key: 'packs',
    label: 'Credits · packs',
    value: (r) => r.creditsByChannel.pack,
  },
  {
    key: 'recharge',
    label: 'Credits · top-ups',
    value: (r) => r.creditsByChannel.recharge,
  },
  {
    key: 'plan',
    label: 'Credits · with plan',
    value: (r) => r.creditsByChannel.plan,
  },
  {
    key: 'granted',
    label: 'Credits · granted',
    value: (r) => r.creditsByChannel.granted,
  },
  {
    key: 'creditRevenueUsd',
    label: 'Credit revenue',
    value: (r) => r.creditRevenueUsd,
    money: true,
  },
  {
    key: 'rechargeRevenueUsd',
    label: 'Top-up revenue',
    value: (r) => r.rechargeRevenueUsd,
    money: true,
  },
  {
    key: 'creditsConsumed',
    label: 'Credits consumed',
    value: (r) => r.creditsConsumed,
  },
  {
    key: 'searchesSettled',
    label: 'Searches run',
    value: (r) => r.searchesSettled,
  },
  {
    key: 'upstreamCostUsd',
    label: 'Search cost',
    value: (r) => r.upstreamCostUsd,
    money: true,
  },
  { key: 'aiCalls', label: 'AI calls', value: (r) => r.aiCalls },
  { key: 'aiFailedCalls', label: 'AI failures', value: (r) => r.aiFailedCalls },
  {
    key: 'aiInputTokens',
    label: 'Input tokens',
    value: (r) => r.aiInputTokens,
  },
  {
    key: 'aiOutputTokens',
    label: 'Output tokens',
    value: (r) => r.aiOutputTokens,
  },
  {
    key: 'aiTotalTokens',
    label: 'Total tokens',
    value: (r) => r.aiTotalTokens,
  },
  {
    key: 'aiCostUsd',
    label: 'AI cost',
    value: (r) => r.aiCostUsd,
    money: true,
  },
  {
    key: 'rechargeSucceeded',
    label: 'Top-ups OK',
    value: (r) => r.rechargeSucceeded,
  },
  {
    key: 'rechargeFailed',
    label: 'Top-ups failed',
    value: (r) => r.rechargeFailed,
  },
];

/**
 * The monthly record as CSV.
 *
 * Months run down the rows rather than across, so the file opens as a tidy
 * one-row-per-period table in a spreadsheet and can be appended to year on
 * year. Values are raw numbers, never the formatted strings on screen -- a
 * "$1,234.00" cell is text to a spreadsheet and will not sum.
 */
function recordCsv(data: PlatformAnalytics): string {
  const columns = RECORD_COLUMNS.filter(
    (c) =>
      data.planRevenueAvailable ||
      ![
        'planRevenueUsd',
        'planPayments',
        'newPlanPayments',
        'renewalPayments',
      ].includes(c.key),
  );
  const header = ['Month', ...columns.map((c) => c.label)];
  const rows = data.series.map((row) => [
    row.month,
    ...columns.map((c) => {
      const value = c.value(row);
      return c.money ? value.toFixed(2) : String(value);
    }),
  ]);
  return [header, ...rows]
    .map((cells) =>
      cells
        // Quote defensively: a column label could gain a comma later, and an
        // unquoted one would silently shift every following column.
        .map((cell) =>
          /[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell,
        )
        .join(','),
    )
    .join('\n');
}

function downloadCsv(data: PlatformAnalytics) {
  const blob = new Blob([recordCsv(data)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const last = data.series[data.series.length - 1]?.month ?? 'export';
  link.download = `aegislead-analytics-${last}-${data.months}m.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function AnalyticsContent() {
  const [range, setRange] = useState<Range>(12);
  const [data, setData] = useState<PlatformAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [showTable, setShowTable] = useState(false);

  const load = useCallback(async (months: Range, isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      setData(await getAnalytics(months));
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not load analytics.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load(range);
  }, [load, range]);

  // Memoised, not `data?.series ?? []` inline: the fallback literal would be a
  // fresh array on every render, so every useMemo keyed on it below would
  // recompute each time and the memoisation would be decorative.
  const series = useMemo(() => data?.series ?? [], [data]);
  const current = series[series.length - 1];
  const previous = series[series.length - 2];
  const labels = useMemo(() => series.map((r) => r.month), [series]);

  /** Totals across the whole window, for the window-scoped cards. */
  const windowTotals = useMemo(() => {
    return series.reduce(
      (acc, row) => ({
        planRevenueUsd: acc.planRevenueUsd + row.planRevenueUsd,
        planPayments: acc.planPayments + row.planPayments,
        creditsPurchased: acc.creditsPurchased + row.creditsPurchased,
        creditRevenueUsd: acc.creditRevenueUsd + row.creditRevenueUsd,
        rechargeRevenueUsd: acc.rechargeRevenueUsd + row.rechargeRevenueUsd,
        tokens: acc.tokens + row.aiTotalTokens,
        aiCostUsd: acc.aiCostUsd + row.aiCostUsd,
        upstreamCostUsd: acc.upstreamCostUsd + row.upstreamCostUsd,
        unpriced: acc.unpriced + row.unpricedPurchases,
      }),
      {
        planRevenueUsd: 0,
        planPayments: 0,
        creditsPurchased: 0,
        creditRevenueUsd: 0,
        rechargeRevenueUsd: 0,
        tokens: 0,
        aiCostUsd: 0,
        upstreamCostUsd: 0,
        unpriced: 0,
      },
    );
  }, [series]);

  const growthSeries: Series[] = useMemo(
    () => [
      {
        key: 'tenants',
        label: 'New accounts',
        color: 0,
        values: series.map((r) => r.newTenants),
      },
      {
        key: 'users',
        label: 'New users',
        color: 1,
        values: series.map((r) => r.newUsers),
      },
    ],
    [series],
  );

  const creditFlowSeries: Series[] = useMemo(
    () => [
      {
        key: 'bought',
        label: 'Purchased',
        color: 0,
        values: series.map((r) => r.creditsPurchased),
      },
      {
        key: 'used',
        label: 'Consumed',
        color: 1,
        values: series.map((r) => r.creditsConsumed),
      },
    ],
    [series],
  );

  const channelSeries: Series[] = useMemo(() => {
    const channels: CreditChannel[] = ['pack', 'recharge', 'plan', 'granted'];
    return channels.map((channel, index) => ({
      key: channel,
      label: CREDIT_CHANNEL_LABELS[channel],
      color: index,
      values: series.map((r) => r.creditsByChannel[channel]),
    }));
  }, [series]);

  const tokenSeries: Series[] = useMemo(
    () => [
      {
        key: 'in',
        label: 'Input tokens',
        color: 0,
        values: series.map((r) => r.aiInputTokens),
      },
      {
        key: 'out',
        label: 'Output tokens',
        color: 1,
        values: series.map((r) => r.aiOutputTokens),
      },
    ],
    [series],
  );

  const moneySeries: Series[] = useMemo(
    () => [
      {
        key: 'revenue',
        label: 'Credit revenue (list)',
        color: 0,
        values: series.map((r) => r.creditRevenueUsd),
        money: true,
      },
      {
        key: 'upstream',
        label: 'Search cost (upstream)',
        color: 1,
        values: series.map((r) => r.upstreamCostUsd),
        money: true,
      },
      {
        key: 'ai',
        label: 'AI cost',
        color: 2,
        values: series.map((r) => r.aiCostUsd),
        money: true,
      },
    ],
    [series],
  );

  const planSeries: Series[] = useMemo(
    () => [
      {
        key: 'new',
        label: 'New subscriptions',
        color: 0,
        values: series.map((r) => r.newPlanPayments),
      },
      {
        key: 'renewals',
        label: 'Renewals',
        color: 1,
        values: series.map((r) => r.renewalPayments),
      },
      {
        key: 'changes',
        label: 'Plan changes',
        color: 2,
        values: series.map(
          (r) => r.planPayments - r.newPlanPayments - r.renewalPayments,
        ),
      },
    ],
    [series],
  );

  const rechargeSeries: Series[] = useMemo(
    () => [
      {
        key: 'ok',
        label: 'Succeeded',
        color: 2,
        values: series.map((r) => r.rechargeSucceeded),
      },
      {
        key: 'failed',
        label: 'Failed',
        color: 1,
        values: series.map((r) => r.rechargeFailed),
      },
    ],
    [series],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-error/30 bg-error-wash p-3 text-sm text-error">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        {error}
      </div>
    );
  }

  if (!data || !current) return null;

  return (
    <>
      {/* Range + actions */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-lg border border-border p-0.5">
          {RANGES.map((months) => (
            <button
              key={months}
              type="button"
              onClick={() => setRange(months)}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-medium transition',
                range === months
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {months} months
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => void load(range, true)}
          disabled={refreshing}
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition hover:text-foreground disabled:opacity-60"
        >
          <RefreshCw
            className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')}
          />
          Refresh
        </button>

        <button
          type="button"
          onClick={() => downloadCsv(data)}
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition hover:text-foreground"
        >
          <Download className="h-3.5 w-3.5" />
          Export CSV
        </button>

        <span className="ml-auto text-xs text-muted-foreground">
          {monthLong(current.month)} so far · months are UTC · generated{' '}
          {formatDateTime(data.generatedAt)}
        </span>
      </div>

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-error/30 bg-error-wash p-3 text-sm text-error">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* --- Where the platform stands right now --- */}
      <h2 className="mb-3 text-sm font-semibold text-foreground">Right now</h2>
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SnapshotCard
          icon={Building2}
          label="Accounts"
          value={data.snapshot.tenants.toLocaleString()}
          hint={
            data.snapshot.suspendedTenants > 0
              ? `${data.snapshot.suspendedTenants} suspended`
              : 'none suspended'
          }
        />
        <SnapshotCard
          icon={Users}
          label="Users"
          value={data.snapshot.users.toLocaleString()}
          hint="verified logins"
        />
        <SnapshotCard
          icon={Coins}
          label="Credits outstanding"
          value={data.snapshot.creditsOutstanding.toLocaleString()}
          hint={`${data.snapshot.creditsPurchasedLifetime.toLocaleString()} ever purchased`}
        />
        <SnapshotCard
          icon={Sparkles}
          label="AI cost (lifetime)"
          value={usd(data.snapshot.aiCostUsdLifetime)}
          hint={`${compact(data.snapshot.aiTokensLifetime)} tokens · ${data.snapshot.aiCallsLifetime.toLocaleString()} calls`}
        />
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SnapshotCard
          icon={CreditCard}
          label="Plan revenue (selected period)"
          value={
            data.planRevenueAvailable
              ? usd(windowTotals.planRevenueUsd)
              : 'Unavailable'
          }
          hint={
            data.planRevenueAvailable
              ? `${windowTotals.planPayments.toLocaleString()} paid invoices`
              : 'Stripe invoice data could not be loaded'
          }
        />
        <SnapshotCard
          icon={Building2}
          label="Paying plans"
          value={data.snapshot.planMix.paying.toLocaleString()}
          hint="current subscribers"
        />
        <SnapshotCard
          icon={Gift}
          label="Free plans"
          value={(
            data.snapshot.planMix.comped + data.snapshot.planMix.trial
          ).toLocaleString()}
          hint={`${data.snapshot.planMix.comped} comped · ${data.snapshot.planMix.trial} trial`}
        />
        <SnapshotCard
          icon={Users}
          label="Without a plan"
          value={data.snapshot.planMix.none.toLocaleString()}
          hint="verified accounts"
        />
      </div>

      <div className="mb-8">
        <div className="grid gap-4 xl:grid-cols-2">
          <ChartCard
            title="Plan mix"
            note="Current state across every verified account, not a monthly figure."
          >
            <SegmentedBar
              segments={[
                {
                  label: 'Paying',
                  value: data.snapshot.planMix.paying,
                  color: 0,
                },
                {
                  label: 'Comped',
                  value: data.snapshot.planMix.comped,
                  color: 1,
                },
                {
                  label: 'Trial',
                  value: data.snapshot.planMix.trial,
                  color: 3,
                },
                {
                  label: 'No plan',
                  value: data.snapshot.planMix.none,
                  color: 2,
                },
              ]}
            />
          </ChartCard>
          <ChartCard
            title="Paying customers by plan"
            note={`${data.snapshot.leadGenAddOns} also have Lead Gen as an add-on.`}
          >
            <RankedBars
              rows={Object.entries(data.snapshot.payingByPackage)
                .filter(([, value]) => value > 0)
                .map(([key, value]) => ({
                  label:
                    key === 'GENERATION'
                      ? 'Generation'
                      : key === 'GUARD'
                        ? 'Guard'
                        : key === 'OPERATIONS'
                          ? 'Operations'
                          : key === 'COMPLETE'
                            ? 'Complete'
                            : 'Other',
                  value,
                }))}
              format={(v) => v.toLocaleString()}
              emptyLabel="No paying plans yet."
            />
          </ChartCard>
        </div>
      </div>

      {/* --- Month over month --- */}
      <h2 className="mb-1 text-sm font-semibold text-foreground">
        {monthLong(current.month)} vs{' '}
        {previous ? monthLong(previous.month) : 'previous month'}
      </h2>
      <p className="mb-3 text-xs text-muted-foreground">
        The current month is still in progress, so it is compared against a full
        one.
      </p>
      <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        {COMPARISON_CARDS.filter(
          (card) =>
            data.planRevenueAvailable ||
            !['planRevenue', 'planPayments'].includes(card.key),
        ).map((card) => (
          <ComparisonCard
            key={card.key}
            label={card.label}
            current={card.value(current)}
            previous={previous ? card.value(previous) : 0}
            format={card.format ?? ((v) => Math.round(v).toLocaleString())}
            polarity={card.polarity}
            hint={card.hint}
          />
        ))}
      </div>

      {/* --- Monthly charts --- */}
      <h2 className="mb-3 text-sm font-semibold text-foreground">
        Last {data.months} months
      </h2>
      <div className="mb-6 grid gap-4 xl:grid-cols-2">
        {data.planRevenueAvailable && (
          <ChartCard
            title="Plan revenue"
            note="Gross USD collected on paid subscription invoices, including renewals and plan changes."
          >
            <MonthlyBarChart
              labels={labels}
              series={[
                {
                  key: 'plans',
                  label: 'Plan revenue',
                  color: 0,
                  values: series.map((r) => r.planRevenueUsd),
                  money: true,
                },
              ]}
              format={(v) => usd(v)}
            />
          </ChartCard>
        )}
        {data.planRevenueAvailable && (
          <ChartCard
            title="Plan payments"
            note="Paid invoices by subscription event. A plan change can generate more than one invoice."
          >
            <MonthlyBarChart labels={labels} series={planSeries} stacked />
            <Legend series={planSeries} />
          </ChartCard>
        )}
        <ChartCard title="Growth: accounts and users">
          <MonthlyBarChart labels={labels} series={growthSeries} />
          <Legend series={growthSeries} />
        </ChartCard>

        <ChartCard
          title="Credits purchased vs consumed"
          note="Both in credits, so one scale compares them directly."
        >
          <MonthlyBarChart labels={labels} series={creditFlowSeries} />
          <Legend series={creditFlowSeries} />
        </ChartCard>

        <ChartCard
          title="Credits by how they were acquired"
          note="Stacked to the month's total. 'Granted' is given away, not sold."
        >
          <MonthlyBarChart labels={labels} series={channelSeries} stacked />
          <Legend series={channelSeries} />
        </ChartCard>

        <ChartCard
          title="AI tokens used"
          note="Input and output stacked to the month's total."
        >
          <MonthlyBarChart labels={labels} series={tokenSeries} stacked />
          <Legend series={tokenSeries} />
        </ChartCard>

        <ChartCard
          title="Money: what came in and what it cost"
          note="All three in USD. Credit revenue is list price; the two costs are actual."
        >
          <MonthlyBarChart
            labels={labels}
            series={moneySeries}
            format={(v) => usd(v)}
          />
          <Legend series={moneySeries} />
        </ChartCard>

        <ChartCard
          title="Automatic top-ups"
          note="A rising failure count means expiring cards, not lost demand."
        >
          <MonthlyBarChart labels={labels} series={rechargeSeries} />
          <Legend series={rechargeSeries} />
        </ChartCard>

        <ChartCard
          title="Modules activated"
          note={data.approximations.moduleActivations}
        >
          <MonthlyBarChart
            labels={labels}
            series={[
              {
                key: 'modules',
                label: 'Modules activated',
                color: 0,
                values: series.map((r) => r.moduleActivations),
              },
            ]}
          />
        </ChartCard>

        <ChartCard
          title="Searches run"
          note="Settled Prospect Search jobs -- the work credits actually paid for."
        >
          <MonthlyBarChart
            labels={labels}
            series={[
              {
                key: 'searches',
                label: 'Searches',
                color: 0,
                values: series.map((r) => r.searchesSettled),
              },
            ]}
          />
        </ChartCard>
      </div>

      {/* --- Rankings over the window --- */}
      <div className="mb-6 grid gap-4 xl:grid-cols-3">
        <ChartCard
          title="AI cost by feature"
          note={`Across the last ${data.months} months.`}
        >
          <RankedBars
            rows={data.breakdowns.aiByFeature.slice(0, 10).map((row) => ({
              label: row.feature
                .toLowerCase()
                .split('_')
                .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
                .join(' '),
              value: row.cost,
              hint: `${compact(row.calls)} calls`,
            }))}
            format={(v) => usd(v, 2)}
          />
        </ChartCard>

        <ChartCard title="AI cost by model" note="Rates differ per model.">
          <RankedBars
            rows={data.breakdowns.aiByModel.slice(0, 10).map((row) => ({
              label: row.model,
              value: row.cost,
              hint: `${compact(row.tokens)} tok`,
            }))}
            format={(v) => usd(v, 2)}
            color={1}
          />
        </ChartCard>

        <ChartCard
          title="Top accounts by credits bought"
          note="Sold credits only."
        >
          <RankedBars
            rows={data.breakdowns.topTenants.slice(0, 10).map((row) => ({
              label: row.name,
              value: row.credits,
              hint: `${row.purchases}×`,
            }))}
            format={compact}
            color={2}
            emptyLabel="No credit purchases in this window."
          />
        </ChartCard>
      </div>

      {/* --- Window totals + caveats --- */}
      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="mb-3 text-sm font-semibold text-foreground">
            Totals over the last {data.months} months
          </h3>
          <dl className="space-y-2 text-sm">
            {data.planRevenueAvailable && (
              <Row
                label="Plan revenue (actual paid invoices)"
                value={usd(windowTotals.planRevenueUsd)}
              />
            )}
            {data.planRevenueAvailable && (
              <Row
                label="Plan payments"
                value={windowTotals.planPayments.toLocaleString()}
              />
            )}
            <Row
              label="Credits purchased"
              value={windowTotals.creditsPurchased.toLocaleString()}
            />
            <Row
              label="Credit revenue (list price)"
              value={usd(windowTotals.creditRevenueUsd)}
            />
            <Row
              label="Top-up revenue (actual)"
              value={usd(windowTotals.rechargeRevenueUsd)}
            />
            <Row
              label="AI tokens used"
              value={windowTotals.tokens.toLocaleString()}
            />
            <Row label="AI cost" value={usd(windowTotals.aiCostUsd)} />
            <Row
              label="Search cost (upstream)"
              value={usd(windowTotals.upstreamCostUsd)}
            />
            <Row
              label="Gross margin on credits"
              value={usd(
                windowTotals.creditRevenueUsd - windowTotals.upstreamCostUsd,
              )}
              hint="list revenue less what the searches cost us"
            />
          </dl>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <Info className="h-4 w-4 text-muted-foreground" />
            How to read these numbers
          </h3>
          <ul className="space-y-2.5 text-xs leading-relaxed text-muted-foreground">
            <li>
              <strong className="text-foreground">Plan revenue</strong> is gross
              USD collected on paid Stripe subscription invoices in the selected
              period. It includes renewals and plan changes. Refunds and tax are
              not separated.
            </li>
            {!data.planRevenueAvailable && (
              <li>
                Stripe invoice data could not be loaded, so plan revenue and
                payment counts are unavailable.
              </li>
            )}
            <li>
              <strong className="text-foreground">Modules activated</strong>{' '}
              counts first access to each module.{' '}
              {data.approximations.moduleActivations}
            </li>
            <li>
              <strong className="text-foreground">Credit revenue</strong> is
              list price. {data.approximations.creditRevenueUsd}
            </li>
            {windowTotals.unpriced > 0 && (
              <li className="text-error">
                <strong>{windowTotals.unpriced}</strong> sold purchase
                {windowTotals.unpriced === 1 ? '' : 's'} in this window matched
                no pack size, so{' '}
                {windowTotals.unpriced === 1 ? 'it is' : 'they are'} missing
                from credit revenue. Usually seeded or hand-written ledger rows.
              </li>
            )}
            <li>
              Months are <strong className="text-foreground">UTC</strong>{' '}
              calendar months, and the newest one is still in progress.
            </li>
            <li>
              Accounts and users count only{' '}
              <strong className="text-foreground">verified</strong> signups, so
              an abandoned registration never appears as a customer.
            </li>
          </ul>
        </div>
      </div>

      {/* --- The record --- */}
      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between gap-3 border-b border-border p-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Monthly record
            </h3>
            <p className="text-xs text-muted-foreground">
              Every figure above, month by month. Also the accessible view of
              the charts.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowTable((open) => !open)}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition hover:text-foreground"
          >
            <Table2 className="h-3.5 w-3.5" />
            {showTable ? 'Hide' : 'Show'} table
          </button>
        </div>

        {showTable && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="sticky left-0 z-10 bg-card px-4 py-2.5 font-medium">
                    Metric
                  </th>
                  {series.map((row) => (
                    <th
                      key={row.month}
                      className="whitespace-nowrap px-3 py-2.5 text-right font-medium tabular-nums"
                    >
                      {row.month}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {RECORD_COLUMNS.filter(
                  (column) =>
                    data.planRevenueAvailable ||
                    ![
                      'planRevenueUsd',
                      'planPayments',
                      'newPlanPayments',
                      'renewalPayments',
                    ].includes(column.key),
                ).map((column) => (
                  <tr
                    key={column.key}
                    className="border-b border-border/60 last:border-0"
                  >
                    <td className="sticky left-0 z-10 bg-card px-4 py-2 text-muted-foreground">
                      {column.label}
                    </td>
                    {series.map((row) => {
                      const value = column.value(row);
                      return (
                        <td
                          key={row.month}
                          className={cn(
                            'whitespace-nowrap px-3 py-2 text-right tabular-nums',
                            value === 0
                              ? 'text-muted-foreground/50'
                              : 'text-foreground',
                          )}
                        >
                          {column.money ? usd(value) : value.toLocaleString()}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

function Row({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border/60 pb-2 last:border-0 last:pb-0">
      <dt className="text-muted-foreground">
        {label}
        {hint && (
          <span className="block text-xs text-muted-foreground/70">{hint}</span>
        )}
      </dt>
      <dd className="shrink-0 font-semibold tabular-nums text-foreground">
        {value}
      </dd>
    </div>
  );
}

function SnapshotCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Building2;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon size={16} />
        <span className="text-xs font-medium uppercase tracking-wide">
          {label}
        </span>
      </div>
      <div className="mt-2 text-2xl font-bold tabular-nums text-foreground">
        {value}
      </div>
      {hint && (
        <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>
      )}
    </div>
  );
}

export default function PlatformAnalyticsPage() {
  const { admin, loading, idleMinutesRemaining, logout } = usePlatformAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!admin) router.replace('/super-admin/login');
  }, [admin, loading, router]);

  // Same gate as the console: reveal nothing until a platform admin is
  // confirmed, so a tenant who guesses the URL sees only this loader.
  if (loading || !admin) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <div className="h-10 w-10 animate-spin rounded-full border-t-2 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-card/95 shadow-sm backdrop-blur">
        <div className="mx-auto flex min-h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <div className="truncate text-sm font-bold tracking-tight text-foreground">
                AegisLead
              </div>
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Platform control
              </div>
            </div>
            <nav
              className="ml-3 hidden items-center gap-1 border-l border-border pl-4 md:flex"
              aria-label="Platform navigation"
            >
              <Link
                href="/super-admin"
                className="inline-flex h-9 items-center gap-2 rounded-lg px-3 text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                <LayoutDashboard className="h-3.5 w-3.5" /> Overview
              </Link>
              <span className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary/10 px-3 text-xs font-semibold text-primary">
                <BarChart3 className="h-3.5 w-3.5" /> Analytics
              </span>
              <Link
                href="/super-admin/sales"
                className="inline-flex h-9 items-center rounded-lg px-3 text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                Sales
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <span
              title="Session locks after 15 minutes without activity"
              className="hidden h-9 items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 text-xs font-semibold text-emerald-700 lg:inline-flex"
            >
              <LockKeyhole className="h-3.5 w-3.5" /> Secure session
              <span className="flex items-center gap-1 font-medium text-emerald-700/75">
                <Clock3 className="h-3 w-3" /> {idleMinutesRemaining}m
              </span>
            </span>
            <div className="hidden items-center gap-2.5 px-2 sm:flex">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-foreground text-xs font-bold text-background">
                {(admin.name || admin.email).slice(0, 1).toUpperCase()}
              </span>
              <div className="max-w-44 leading-tight">
                <div className="truncate text-xs font-semibold text-foreground">
                  {admin.name || 'Platform operator'}
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {admin.email}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={async () => {
                await logout();
                router.replace('/super-admin/login');
              }}
              className="flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <h1 className="text-xl font-bold text-foreground">Analytics</h1>
        <p className="mb-6 mt-1 text-sm text-muted-foreground">
          Growth, plan payments, credit sales, AI consumption and cost — recorded month by
          month.
        </p>
        <AnalyticsContent />
      </main>
    </div>
  );
}
