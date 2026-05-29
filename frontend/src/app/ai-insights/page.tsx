'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';
import {
  AiInsightItem,
  AiInsightMetric,
  AiInsightsDashboard,
  AiInsightSeverity,
  AiRecommendation,
  getAiInsightsDashboard,
} from '@/lib/ai-insights';
import { getApiErrorMessage } from '@/lib/api-error';
import {
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  Clock,
  FileWarning,
  Lightbulb,
  Loader2,
  MapPin,
  Receipt,
  RefreshCcw,
  ShieldCheck,
  TrendingUp,
  Users,
} from 'lucide-react';

type BarTone = 'sky' | 'emerald' | 'amber' | 'rose' | 'violet';

interface BarItem {
  label: string;
  value: number;
  valueLabel: string;
  detail?: string;
  tone: BarTone;
}

const severityStyles: Record<AiInsightSeverity, string> = {
  positive: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200',
  info: 'border-sky-400/20 bg-sky-400/10 text-sky-200',
  warning: 'border-amber-400/20 bg-amber-400/10 text-amber-200',
  critical: 'border-rose-400/20 bg-rose-400/10 text-rose-200',
};

const priorityStyles: Record<AiRecommendation['priority'], string> = {
  high: 'border-rose-400/25 bg-rose-400/10 text-rose-200',
  medium: 'border-amber-400/25 bg-amber-400/10 text-amber-200',
  low: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200',
};

const barStyles: Record<BarTone, string> = {
  sky: 'bg-sky-400',
  emerald: 'bg-emerald-400',
  amber: 'bg-amber-400',
  rose: 'bg-rose-400',
  violet: 'bg-violet-400',
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: value >= 1000 ? 0 : 2,
  }).format(value);
}

function formatPercent(value: number | null) {
  return value === null ? 'N/A' : `${value}%`;
}

function MetricGrid({ metrics }: { metrics: AiInsightMetric[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => (
        <div key={metric.label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-slate-400">{metric.label}</p>
            <span className={`h-2.5 w-2.5 rounded-full ${metric.tone === 'critical' ? 'bg-rose-300' : metric.tone === 'warning' ? 'bg-amber-300' : metric.tone === 'positive' ? 'bg-emerald-300' : 'bg-sky-300'}`} />
          </div>
          <div className="break-words text-2xl font-black text-white sm:text-3xl">{metric.value}</div>
          {metric.detail && <div className="mt-2 text-sm text-slate-400">{metric.detail}</div>}
        </div>
      ))}
    </div>
  );
}

function InsightList({ insights }: { insights: AiInsightItem[] }) {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {insights.map((insight) => (
        <div key={insight.id} className={`rounded-2xl border p-4 ${severityStyles[insight.severity]}`}>
          <div className="mb-2 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h4 className="font-bold text-white">{insight.title}</h4>
              {insight.subject && <p className="mt-1 text-xs text-slate-300">{insight.subject}</p>}
            </div>
            {insight.severity === 'positive' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
          </div>
          <p className="text-sm leading-6 text-slate-200">{insight.message}</p>
          {insight.metricLabel && (
            <div className="mt-3 text-xs font-semibold text-slate-300">
              {insight.metricLabel}: {insight.metricValue}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function BarList({ title, items }: { title: string; items: BarItem[] }) {
  const max = Math.max(...items.map((item) => item.value), 1);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
      <h4 className="mb-4 font-bold text-white">{title}</h4>
      <div className="space-y-4">
        {items.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-400">No data yet.</div>
        ) : (
          items.map((item) => {
            const width = item.value <= 0 ? 0 : Math.max(8, (item.value / max) * 100);
            return (
              <div key={item.label}>
                <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate font-semibold text-slate-200">{item.label}</span>
                  <span className="shrink-0 font-bold text-white">{item.valueLabel}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/10">
                  <div className={`h-full rounded-full ${barStyles[item.tone]}`} style={{ width: `${width}%` }} />
                </div>
                {item.detail && <div className="mt-1 text-xs text-slate-500">{item.detail}</div>}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function SectionHeader({ icon: Icon, title }: { icon: typeof Users; title: string }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <Icon className="text-sky-300" size={22} />
      <h3 className="text-xl font-bold text-white sm:text-2xl">{title}</h3>
    </div>
  );
}

function Recommendations({ recommendations }: { recommendations: AiRecommendation[] }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {recommendations.map((recommendation) => (
        <div key={recommendation.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h4 className="font-bold text-white">{recommendation.title}</h4>
              <p className="mt-1 text-sm text-slate-400">{recommendation.category}</p>
            </div>
            <span className={`rounded-full border px-3 py-1 text-xs font-bold ${priorityStyles[recommendation.priority]}`}>
              {recommendation.priority}
            </span>
          </div>
          <p className="text-sm font-semibold leading-6 text-slate-100">{recommendation.action}</p>
          <p className="mt-3 text-sm leading-6 text-slate-400">{recommendation.reason}</p>
          <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-slate-500">
            <Lightbulb size={14} />
            {recommendation.source === 'ai' ? 'AI' : 'Rule'}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AiInsightsPage() {
  const [dashboard, setDashboard] = useState<AiInsightsDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const data = await getAiInsightsDashboard();
      setDashboard(data);
      setError('');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not load AI insights.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const clientBars = useMemo<BarItem[]>(() => {
    if (!dashboard) return [];
    return dashboard.clients.rows.slice(0, 5).map((client) => ({
      label: client.name,
      value: client.revenue,
      valueLabel: formatCurrency(client.revenue),
      detail: `${client.revenueShare}% of monthly revenue`,
      tone: 'sky',
    }));
  }, [dashboard]);

  const guardBars = useMemo<BarItem[]>(() => {
    if (!dashboard) return [];
    return dashboard.guards.rows.slice(0, 5).map((guard) => ({
      label: guard.name,
      value: guard.missedShifts + guard.lateCheckIns,
      valueLabel: `${guard.missedShifts} missed, ${guard.lateCheckIns} late`,
      detail: `${formatPercent(guard.attendanceRate)} attendance`,
      tone: guard.missedShifts > 0 ? 'rose' : 'emerald',
    }));
  }, [dashboard]);

  const siteBars = useMemo<BarItem[]>(() => {
    if (!dashboard) return [];
    return dashboard.sites.rows.slice(0, 5).map((site) => ({
      label: site.name,
      value: site.incidentCount + site.coverageIssues,
      valueLabel: `${site.incidentCount} incidents`,
      detail: `${site.coverageIssues} coverage issues`,
      tone: site.coverageIssues > 0 ? 'amber' : 'violet',
    }));
  }, [dashboard]);

  const billingBars = useMemo<BarItem[]>(() => {
    if (!dashboard) return [];
    return dashboard.billing.rows.slice(0, 5).map((client) => ({
      label: client.name,
      value: client.outstandingAmount,
      valueLabel: formatCurrency(client.outstandingAmount),
      detail: `${client.invoiceCount} invoices`,
      tone: client.outstandingAmount > 0 ? 'amber' : 'emerald',
    }));
  }, [dashboard]);

  return (
    <DashboardLayout allowedRoles={['admin']}>
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="flex items-center gap-3 text-2xl font-bold sm:text-3xl">
            <BrainCircuit className="text-sky-300" size={29} />
            AI Insights
          </h2>
          <p className="mt-2 text-slate-400">Operational, client, guard, site, and billing signals.</p>
        </div>
        <button
          type="button"
          onClick={loadDashboard}
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
          Loading AI insights...
        </div>
      ) : dashboard ? (
        <div className="space-y-10">
          <section>
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <SectionHeader icon={TrendingUp} title="Overview" />
              <span className="w-fit rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-bold text-slate-300">
                {dashboard.source === 'ai_assisted' ? 'AI assisted' : 'Rule based fallback'}
              </span>
            </div>
            <MetricGrid metrics={dashboard.overview.summary} />
            <div className="mt-4">
              <InsightList insights={dashboard.overview.insights} />
            </div>
          </section>

          <section>
            <SectionHeader icon={FileWarning} title="Incident Risk" />
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h4 className="font-bold text-white">Incident analysis and risk detection</h4>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    Review high-risk sites, severity trends, recurring incident types, guard indicators, and AI/rule recommendations.
                  </p>
                </div>
                <Link
                  href="/ai-insights/incidents"
                  className="inline-flex min-h-11 items-center justify-center rounded-xl bg-rose-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-rose-400"
                >
                  Open Incident Risk
                </Link>
              </div>
            </div>
          </section>

          <section>
            <SectionHeader icon={Users} title="Clients" />
            <MetricGrid metrics={dashboard.clients.summary} />
            <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
              <InsightList insights={dashboard.clients.insights} />
              <BarList title="Revenue by client" items={clientBars} />
            </div>
          </section>

          <section>
            <SectionHeader icon={ShieldCheck} title="Guards" />
            <MetricGrid metrics={dashboard.guards.summary} />
            <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
              <InsightList insights={dashboard.guards.insights} />
              <BarList title="Attendance exceptions" items={guardBars} />
            </div>
          </section>

          <section>
            <SectionHeader icon={MapPin} title="Sites" />
            <MetricGrid metrics={dashboard.sites.summary} />
            <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
              <InsightList insights={dashboard.sites.insights} />
              <BarList title="Site pressure" items={siteBars} />
            </div>
          </section>

          <section>
            <SectionHeader icon={Receipt} title="Billing" />
            <MetricGrid metrics={dashboard.billing.summary} />
            <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
              <InsightList insights={dashboard.billing.insights} />
              <BarList title="Outstanding by client" items={billingBars} />
            </div>
          </section>

          <section>
            <SectionHeader icon={FileWarning} title="Recommendations" />
            <Recommendations recommendations={dashboard.recommendations} />
          </section>

          <div className="flex items-center gap-2 pb-2 text-sm text-slate-500">
            <Clock size={15} />
            Generated {new Date(dashboard.generatedAt).toLocaleString()}
          </div>
        </div>
      ) : null}
    </DashboardLayout>
  );
}
