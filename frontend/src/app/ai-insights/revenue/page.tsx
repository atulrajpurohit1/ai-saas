'use client';

import React, { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import {
  AiInsightMetric,
  AiRecommendation,
  ClientValueRow,
  ContractHealthRow,
  RenewalOpportunityRow,
  RevenueForecastMonth,
  RevenueInsightsDashboard,
  getAiRevenueInsights,
} from '@/lib/ai-insights';
import { getApiErrorMessage } from '@/lib/api-error';
import {
  AlertTriangle,
  BarChart3,
  BrainCircuit,
  BriefcaseBusiness,
  CalendarClock,
  CheckCircle2,
  DollarSign,
  Lightbulb,
  Loader2,
  RefreshCcw,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react';

const metricToneClass: Record<string, string> = {
  positive: 'bg-emerald-300',
  info: 'bg-sky-300',
  warning: 'bg-amber-300',
  critical: 'bg-rose-300',
};

const healthStyles: Record<ContractHealthRow['healthStatus'], string> = {
  Excellent: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200',
  Good: 'border-sky-400/25 bg-sky-400/10 text-sky-200',
  Warning: 'border-amber-400/25 bg-amber-400/10 text-amber-200',
  'High Risk': 'border-rose-400/25 bg-rose-400/10 text-rose-200',
};

const priorityStyles: Record<AiRecommendation['priority'], string> = {
  high: 'border-rose-400/25 bg-rose-400/10 text-rose-200',
  medium: 'border-amber-400/25 bg-amber-400/10 text-amber-200',
  low: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200',
};

const opportunityLabels: Record<RenewalOpportunityRow['type'], string> = {
  renewal_due: 'Renewal due',
  inactive_client: 'Inactive client',
  declining_revenue: 'Declining revenue',
  pricing_review: 'Pricing review',
};

function formatMoney(value: number) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: value >= 1000 ? 0 : 2,
  }).format(value);
}

function formatDate(value: string | null) {
  if (!value) return 'Open ended';

  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function MetricGrid({ metrics }: { metrics: AiInsightMetric[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => (
        <div key={metric.label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-slate-400">{metric.label}</p>
            <span className={`h-2.5 w-2.5 rounded-full ${metricToneClass[metric.tone || 'info']}`} />
          </div>
          <div className="break-words text-2xl font-black text-white sm:text-3xl">{metric.value}</div>
          {metric.detail && <div className="mt-2 text-sm text-slate-400">{metric.detail}</div>}
        </div>
      ))}
    </div>
  );
}

function SectionHeader({
  icon: Icon,
  title,
}: {
  icon: React.ElementType;
  title: string;
}) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <Icon className="text-sky-300" size={22} />
      <h3 className="text-xl font-bold text-white sm:text-2xl">{title}</h3>
    </div>
  );
}

function ScoreBar({
  value,
  tone = 'sky',
}: {
  value: number;
  tone?: 'sky' | 'emerald' | 'amber' | 'rose';
}) {
  const fillClass =
    tone === 'emerald'
      ? 'bg-emerald-400'
      : tone === 'amber'
        ? 'bg-amber-400'
        : tone === 'rose'
          ? 'bg-rose-400'
          : 'bg-sky-400';

  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
      <div className={`h-full rounded-full ${fillClass}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

function RevenueChart({ months }: { months: RevenueForecastMonth[] }) {
  const chartMonths = months.slice(-18);
  const maxRevenue = Math.max(
    ...chartMonths.map((month) => Math.max(month.actualRevenue, month.forecastRevenue)),
    1,
  );

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h4 className="font-bold text-white">Revenue Trend</h4>
        <div className="flex items-center gap-3 text-xs font-semibold text-slate-400">
          <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-400" />Actual</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-sky-400" />Forecast</span>
        </div>
      </div>
      <div className="flex h-64 items-end gap-2 overflow-x-auto pb-2">
        {chartMonths.map((month) => {
          const value = month.type === 'forecast' ? month.forecastRevenue : month.actualRevenue;
          const height = value <= 0 ? 3 : Math.max(8, (value / maxRevenue) * 100);
          return (
            <div key={`${month.type}-${month.month}`} className="flex min-w-12 flex-1 flex-col items-center gap-2">
              <div className="flex h-44 w-full items-end">
                <div
                  className={`w-full rounded-t-lg ${month.type === 'forecast' ? 'bg-sky-400/80' : 'bg-emerald-400/85'}`}
                  style={{ height: `${height}%` }}
                  title={`${month.label}: ${formatMoney(value)}`}
                />
              </div>
              <div className="w-16 truncate text-center text-[11px] font-semibold text-slate-500">{month.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ClientValueTable({ rows }: { rows: ClientValueRow[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
      <div className="border-b border-white/5 px-5 py-4">
        <h4 className="font-bold text-white">Client Scores</h4>
      </div>
      <div className="overflow-x-auto">
        <table className="responsive-table w-full text-left">
          <thead>
            <tr className="border-b border-white/5 text-sm uppercase tracking-wider text-slate-500">
              <th className="px-5 py-4 font-semibold">Client</th>
              <th className="px-5 py-4 font-semibold">Revenue</th>
              <th className="px-5 py-4 font-semibold">Value</th>
              <th className="px-5 py-4 font-semibold">Retention</th>
              <th className="px-5 py-4 font-semibold">Growth</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {rows.slice(0, 8).map((client) => (
              <tr key={client.clientId} className="transition hover:bg-white/5">
                <td className="px-5 py-4" data-label="Client">
                  <div className="font-bold text-white">{client.name}</div>
                  <div className="mt-1 text-xs text-slate-500">{client.revenueShare}% share | {client.growthRate}% growth</div>
                </td>
                <td className="px-5 py-4 text-sm font-bold text-white" data-label="Revenue">{formatMoney(client.totalRevenue)}</td>
                <td className="px-5 py-4" data-label="Value">
                  <div className="mb-2 text-sm font-bold text-white">{client.clientValueScore}/100</div>
                  <ScoreBar value={client.clientValueScore} tone={client.clientValueScore >= 70 ? 'emerald' : client.clientValueScore >= 45 ? 'sky' : 'amber'} />
                </td>
                <td className="px-5 py-4" data-label="Retention">
                  <div className="mb-2 text-sm font-bold text-white">{client.retentionScore}/100</div>
                  <ScoreBar value={client.retentionScore} tone={client.retentionScore >= 70 ? 'emerald' : client.retentionScore >= 45 ? 'amber' : 'rose'} />
                </td>
                <td className="px-5 py-4" data-label="Growth">
                  <div className="mb-2 text-sm font-bold text-white">{client.growthPotentialScore}/100</div>
                  <ScoreBar value={client.growthPotentialScore} tone={client.growthPotentialScore >= 70 ? 'emerald' : 'sky'} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ContractHealthGrid({ rows }: { rows: ContractHealthRow[] }) {
  return (
    <div className="grid gap-4 xl:grid-cols-3">
      {rows.slice(0, 6).map((contract) => (
        <div key={contract.clientId} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h4 className="truncate font-bold text-white">{contract.name}</h4>
              <p className="mt-1 text-sm text-slate-500">{contract.invoiceCount} invoices | {formatMoney(contract.totalRevenue)}</p>
            </div>
            <span className={`shrink-0 rounded-full border px-3 py-1 text-xs font-bold ${healthStyles[contract.healthStatus]}`}>
              {contract.healthStatus}
            </span>
          </div>
          <div className="mb-3 flex items-end justify-between gap-3">
            <div className="text-3xl font-black text-white">{contract.healthScore}</div>
            <div className="text-right text-xs font-semibold text-slate-500">Renewal<br />{contract.daysUntilRenewal === null ? 'N/A' : `${contract.daysUntilRenewal} days`}</div>
          </div>
          <ScoreBar value={contract.healthScore} tone={contract.healthScore >= 80 ? 'emerald' : contract.healthScore >= 60 ? 'sky' : contract.healthScore >= 40 ? 'amber' : 'rose'} />
          <div className="mt-4 flex flex-wrap gap-2">
            {contract.indicators.slice(0, 4).map((indicator) => (
              <span key={indicator} className="rounded-full border border-white/10 bg-black/15 px-2.5 py-1 text-[11px] font-semibold text-slate-300">
                {indicator}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function RenewalPanels({ rows }: { rows: RenewalOpportunityRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-8 text-center text-sm font-semibold text-slate-400">
        No renewal opportunities flagged.
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {rows.slice(0, 6).map((opportunity) => (
        <div key={opportunity.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h4 className="font-bold text-white">{opportunity.name}</h4>
              <p className="mt-1 text-sm text-slate-500">{opportunityLabels[opportunity.type]} | {formatDate(opportunity.dueDate)}</p>
            </div>
            <span className={`rounded-full border px-3 py-1 text-xs font-bold ${priorityStyles[opportunity.priority]}`}>
              {opportunity.priority}
            </span>
          </div>
          <p className="text-sm font-semibold leading-6 text-slate-100">{opportunity.recommendation}</p>
          <p className="mt-3 text-sm leading-6 text-slate-400">{opportunity.reason}</p>
          <div className="mt-4 text-xs font-bold uppercase tracking-wider text-slate-500">
            Revenue at risk: {formatMoney(opportunity.estimatedRevenueAtRisk)}
          </div>
        </div>
      ))}
    </div>
  );
}

function RecommendationGrid({ recommendations }: { recommendations: AiRecommendation[] }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {recommendations.map((recommendation) => (
        <div key={recommendation.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h4 className="font-bold text-white">{recommendation.title}</h4>
              <p className="mt-1 text-sm capitalize text-slate-500">{recommendation.category} | {recommendation.source === 'ai' ? 'AI' : 'Rule'}</p>
            </div>
            <span className={`rounded-full border px-3 py-1 text-xs font-bold ${priorityStyles[recommendation.priority]}`}>
              {recommendation.priority}
            </span>
          </div>
          <p className="text-sm font-semibold leading-6 text-slate-100">{recommendation.action}</p>
          <p className="mt-3 text-sm leading-6 text-slate-400">{recommendation.reason}</p>
        </div>
      ))}
    </div>
  );
}

export default function RevenueInsightsPage() {
  const [dashboard, setDashboard] = useState<RevenueInsightsDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadRevenue = async () => {
    setLoading(true);
    try {
      const data = await getAiRevenueInsights();
      setDashboard(data);
      setError('');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not load revenue intelligence.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRevenue();
  }, []);

  const trendIcon = useMemo(() => {
    if (!dashboard) return TrendingUp;
    return dashboard.forecast.monthlyGrowthRate >= 0 ? TrendingUp : TrendingDown;
  }, [dashboard]);

  const TrendIcon = trendIcon;

  return (
    <DashboardLayout allowedRoles={['admin', 'finance']}>
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="flex items-center gap-3 text-2xl font-bold sm:text-3xl">
            <BrainCircuit className="text-sky-300" size={29} />
            AI Revenue Intelligence
          </h2>
          <p className="mt-2 text-slate-400">Forecasts, contract health, client value, renewals, and finance actions.</p>
        </div>
        <button
          type="button"
          onClick={loadRevenue}
          disabled={loading}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-sky-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-sky-400 disabled:opacity-60"
        >
          {loading ? <Loader2 className="animate-spin" size={17} /> : <RefreshCcw size={17} />}
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-5 py-4 text-sm font-semibold text-rose-300">
          <AlertTriangle size={18} />
          {error}
        </div>
      )}

      {loading && !dashboard ? (
        <div className="py-24 text-center text-slate-400">
          <Loader2 className="mx-auto mb-3 animate-spin text-sky-300" size={28} />
          Loading revenue intelligence...
        </div>
      ) : dashboard ? (
        <div className="space-y-10">
          <section>
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <SectionHeader icon={DollarSign} title="Revenue Forecast" />
              <span className="w-fit rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-bold text-slate-300">
                {dashboard.source === 'ai_assisted' ? 'AI assisted' : 'Rule based fallback'} | {dashboard.forecast.confidence} confidence
              </span>
            </div>
            <MetricGrid metrics={dashboard.forecast.summary} />
            <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
              <RevenueChart months={dashboard.forecast.months} />
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                <div className="mb-4 flex items-center gap-3">
                  <TrendIcon className={dashboard.forecast.monthlyGrowthRate >= 0 ? 'text-emerald-300' : 'text-rose-300'} size={21} />
                  <h4 className="font-bold text-white">AI Summary</h4>
                </div>
                <p className="text-sm leading-7 text-slate-300">{dashboard.aiSummary}</p>
                <div className="mt-5 border-t border-white/10 pt-4 text-sm leading-6 text-slate-500">
                  {dashboard.forecast.methodology}
                </div>
              </div>
            </div>
          </section>

          <section>
            <SectionHeader icon={Users} title="Client Value Analysis" />
            <MetricGrid metrics={dashboard.clientValue.summary} />
            <div className="mt-4">
              <ClientValueTable rows={dashboard.clientValue.rows} />
            </div>
          </section>

          <section>
            <SectionHeader icon={BriefcaseBusiness} title="Contract Health" />
            <MetricGrid metrics={dashboard.contracts.summary} />
            <div className="mt-4">
              <ContractHealthGrid rows={dashboard.contracts.rows} />
            </div>
          </section>

          <section>
            <SectionHeader icon={CalendarClock} title="Renewal Opportunities" />
            <MetricGrid metrics={dashboard.renewals.summary} />
            <div className="mt-4">
              <RenewalPanels rows={dashboard.renewals.rows} />
            </div>
          </section>

          <section>
            <SectionHeader icon={Lightbulb} title="Financial Recommendations" />
            <MetricGrid metrics={dashboard.recommendations.summary} />
            <div className="mt-4">
              <RecommendationGrid recommendations={dashboard.recommendations.recommendations} />
            </div>
          </section>

          <div className="flex flex-wrap items-center gap-4 pb-2 text-sm text-slate-500">
            <span className="inline-flex items-center gap-2">
              <BarChart3 size={15} />
              Generated {new Date(dashboard.generatedAt).toLocaleString()}
            </span>
            <span className="inline-flex items-center gap-2">
              <CheckCircle2 size={15} />
              {dashboard.recommendations.source === 'ai_assisted' ? 'AI recommendations active' : 'Fallback recommendations active'}
            </span>
          </div>
        </div>
      ) : null}
    </DashboardLayout>
  );
}
