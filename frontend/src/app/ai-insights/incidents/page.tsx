'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';
import {
  AiInsightMetric,
  AiRecommendation,
  IncidentInsightsResponse,
  IncidentRiskRow,
  IncidentTrendRow,
  getAiIncidentInsights,
} from '@/lib/ai-insights';
import { getApiErrorMessage } from '@/lib/api-error';
import {
  AlertTriangle,
  BarChart3,
  BrainCircuit,
  Clock,
  FileWarning,
  Lightbulb,
  Loader2,
  MapPin,
  RefreshCcw,
  ShieldAlert,
  ShieldCheck,
  Users,
} from 'lucide-react';

const riskStyles: Record<IncidentRiskRow['riskLevel'], string> = {
  critical: 'border-rose-400/30 bg-rose-400/10 text-rose-200',
  high: 'border-amber-400/30 bg-amber-400/10 text-amber-200',
  medium: 'border-sky-400/25 bg-sky-400/10 text-sky-200',
  low: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200',
};

const priorityStyles: Record<AiRecommendation['priority'], string> = {
  high: 'border-rose-400/25 bg-rose-400/10 text-rose-200',
  medium: 'border-amber-400/25 bg-amber-400/10 text-amber-200',
  low: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200',
};

const severityColors: Record<string, string> = {
  critical: 'bg-rose-400',
  high: 'bg-amber-400',
  medium: 'bg-sky-400',
  low: 'bg-emerald-400',
};

function formatDate(value: string | null) {
  if (!value) return 'No recent incident';

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
            <span className={`h-2.5 w-2.5 rounded-full ${metric.tone === 'critical' ? 'bg-rose-300' : metric.tone === 'warning' ? 'bg-amber-300' : metric.tone === 'positive' ? 'bg-emerald-300' : 'bg-sky-300'}`} />
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

function RiskList({
  title,
  icon: Icon,
  rows,
}: {
  title: string;
  icon: React.ElementType;
  rows: IncidentRiskRow[];
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
      <div className="mb-4 flex items-center gap-3">
        <Icon size={19} className="text-sky-300" />
        <h4 className="font-bold text-white">{title}</h4>
      </div>

      {rows.length === 0 ? (
        <div className="py-8 text-center text-sm text-slate-400">No risk indicators yet.</div>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <div key={`${row.entityType}-${row.entityId}`} className={`rounded-2xl border p-4 ${riskStyles[row.riskLevel]}`}>
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-bold text-white">{row.name}</div>
                  <div className="mt-1 text-xs text-slate-300">
                    {row.relatedName || `${row.incidentCount} incidents`} | Last: {formatDate(row.lastIncidentAt)}
                  </div>
                </div>
                <span className="shrink-0 rounded-full border border-white/15 bg-black/15 px-3 py-1 text-xs font-black text-white">
                  {row.riskScore}
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                {row.indicators.slice(0, 3).map((indicator) => (
                  <span key={indicator} className="rounded-full border border-white/10 bg-black/15 px-2.5 py-1 text-[11px] font-semibold text-slate-100">
                    {indicator}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SeverityBreakdown({ data }: { data: IncidentInsightsResponse['severityBreakdown'] }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
      <h4 className="mb-4 font-bold text-white">Severity Breakdown</h4>
      <div className="space-y-4">
        {data.map((item) => (
          <div key={item.severity}>
            <div className="mb-2 flex items-center justify-between gap-3 text-sm">
              <span className="font-semibold capitalize text-slate-200">{item.severity}</span>
              <span className="font-bold text-white">{item.count} ({item.percent}%)</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className={`h-full rounded-full ${severityColors[item.severity] || 'bg-slate-400'}`}
                style={{ width: `${Math.max(item.percent, item.count > 0 ? 8 : 0)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TrendList({ title, trends }: { title: string; trends: IncidentTrendRow[] }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
      <h4 className="mb-4 font-bold text-white">{title}</h4>
      {trends.length === 0 ? (
        <div className="py-8 text-center text-sm text-slate-400">No repeated pattern yet.</div>
      ) : (
        <div className="space-y-3">
          {trends.map((trend) => (
            <div key={trend.id} className="rounded-2xl border border-white/10 bg-black/10 p-4">
              <div className="mb-2 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-bold text-white">{trend.label}</div>
                  <div className="mt-1 text-sm text-slate-400">{trend.detail}</div>
                </div>
                <span className="shrink-0 rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-xs font-bold text-sky-200">
                  {trend.count}
                </span>
              </div>
              <div className="text-xs font-semibold text-slate-500">Risk weight: {trend.riskScore}</div>
            </div>
          ))}
        </div>
      )}
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
              <p className="mt-1 text-sm text-slate-400">{recommendation.source === 'ai' ? 'AI' : 'Rule based'}</p>
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

export default function IncidentInsightsPage() {
  const [data, setData] = useState<IncidentInsightsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadIncidents = async () => {
    setLoading(true);
    try {
      const result = await getAiIncidentInsights();
      setData(result);
      setError('');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not load incident risk insights.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadIncidents();
  }, []);

  return (
    <DashboardLayout allowedRoles={['admin', 'supervisor']}>
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Link href="/ai-insights" className="mb-3 inline-flex text-sm font-semibold text-sky-300 hover:text-sky-200">
            Back to AI Insights
          </Link>
          <h2 className="flex items-center gap-3 text-2xl font-bold sm:text-3xl">
            <ShieldAlert className="text-rose-300" size={30} />
            Incident Risk
          </h2>
          <p className="mt-2 text-slate-400">AI and rule-based detection for recurring incidents, high-risk sites, and response gaps.</p>
        </div>
        <button
          type="button"
          onClick={loadIncidents}
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

      {loading && !data ? (
        <div className="py-24 text-center text-slate-400">
          <Loader2 className="mx-auto mb-3 animate-spin text-sky-300" size={28} />
          Loading incident risk...
        </div>
      ) : data ? (
        <div className="space-y-10">
          <section>
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <SectionHeader icon={BarChart3} title="Risk Overview" />
              <span className="w-fit rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-bold text-slate-300">
                {data.source === 'ai_assisted' ? 'AI assisted' : 'Rule based fallback'}
              </span>
            </div>
            <MetricGrid metrics={data.summary} />
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <div className="mb-3 flex items-center gap-3">
              <BrainCircuit size={21} className="text-sky-300" />
              <h3 className="font-bold text-white">Analysis Summary</h3>
            </div>
            <p className="text-sm leading-7 text-slate-300">{data.aiSummary}</p>
          </section>

          <section>
            <SectionHeader icon={FileWarning} title="Risk Indicators" />
            <div className="grid gap-4 xl:grid-cols-3">
              <RiskList title="High-Risk Sites" icon={MapPin} rows={data.highRiskSites} />
              <RiskList title="Client Risk" icon={Users} rows={data.clientRisks} />
              <RiskList title="Guard Risk" icon={ShieldCheck} rows={data.guardRisks} />
            </div>
          </section>

          <section>
            <SectionHeader icon={Clock} title="Patterns" />
            <div className="grid gap-4 xl:grid-cols-3">
              <SeverityBreakdown data={data.severityBreakdown} />
              <TrendList title="Recurring Incident Types" trends={data.recurringIncidentTypes} />
              <TrendList title="Time And Day Patterns" trends={data.timePatterns} />
            </div>
          </section>

          <section>
            <SectionHeader icon={Lightbulb} title="Recommendations" />
            <Recommendations recommendations={data.recommendations} />
          </section>

          <div className="pb-2 text-sm text-slate-500">
            Generated {new Date(data.generatedAt).toLocaleString()}
          </div>
        </div>
      ) : null}
    </DashboardLayout>
  );
}
