'use client';

import React, { useEffect, useMemo, useState } from 'react';
import AiFeedbackControl from '@/components/AiFeedbackControl';
import DashboardLayout from '@/components/DashboardLayout';
import { getApiErrorMessage } from '@/lib/api-error';
import {
  AiExecutiveCenterDashboard,
  BusinessHealthStatus,
  ExecutiveOpportunityItem,
  ExecutiveRiskItem,
  WorkforcePerformanceRow,
  getExecutiveCenterDashboard,
} from '@/lib/ai-executive-center';
import { AiInsightMetric, AiRecommendation, AiRiskLevel } from '@/lib/ai-insights';
import {
  AlertTriangle,
  ArrowUpRight,
  BrainCircuit,
  Briefcase,
  CalendarClock,
  Clock,
  FileWarning,
  Lightbulb,
  Loader2,
  MapPin,
  RefreshCcw,
  ShieldCheck,
  TrendingUp,
  Users,
} from 'lucide-react';

const healthStyles: Record<BusinessHealthStatus, string> = {
  Excellent: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200',
  Good: 'border-sky-400/25 bg-sky-400/10 text-sky-200',
  Warning: 'border-amber-400/25 bg-amber-400/10 text-amber-200',
  Critical: 'border-rose-400/25 bg-rose-400/10 text-rose-200',
};

const riskStyles: Record<AiRiskLevel, string> = {
  critical: 'border-rose-400/30 bg-rose-400/10 text-rose-200',
  high: 'border-orange-400/30 bg-orange-400/10 text-orange-200',
  medium: 'border-amber-400/25 bg-amber-400/10 text-amber-200',
  low: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200',
};

const priorityStyles: Record<AiRecommendation['priority'], string> = {
  high: 'border-rose-400/25 bg-rose-400/10 text-rose-200',
  medium: 'border-amber-400/25 bg-amber-400/10 text-amber-200',
  low: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200',
};

const metricTone = {
  positive: 'bg-emerald-300',
  info: 'bg-sky-300',
  warning: 'bg-amber-300',
  critical: 'bg-rose-300',
};

function formatCurrency(value?: number | null) {
  if (value === null || value === undefined) return 'N/A';

  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: value >= 1000 ? 0 : 2,
  }).format(value);
}

function MetricGrid({ metrics }: { metrics: AiInsightMetric[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric, index) => (
        <div key={`${metric.label}-${index}`} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-slate-400">{metric.label}</p>
            <span className={`h-2.5 w-2.5 rounded-full ${metricTone[metric.tone || 'info']}`} />
          </div>
          <div className="break-words text-2xl font-black text-white sm:text-3xl">{metric.value}</div>
          {metric.detail && <div className="mt-2 text-sm text-slate-400">{metric.detail}</div>}
        </div>
      ))}
    </div>
  );
}

function SectionHeader({ icon: Icon, title, badge }: { icon: typeof Users; title: string; badge?: string }) {
  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <Icon className="text-sky-300" size={22} />
        <h3 className="text-xl font-bold text-white sm:text-2xl">{title}</h3>
      </div>
      {badge && (
        <span className="w-fit rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-bold text-slate-300">
          {badge}
        </span>
      )}
    </div>
  );
}

function ScoreBar({ value, tone = 'sky' }: { value: number; tone?: 'sky' | 'emerald' | 'amber' | 'rose' }) {
  const color = {
    sky: 'bg-sky-400',
    emerald: 'bg-emerald-400',
    amber: 'bg-amber-400',
    rose: 'bg-rose-400',
  }[tone];

  return (
    <div className="h-2 overflow-hidden rounded-full bg-white/10">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(4, Math.min(100, value))}%` }} />
    </div>
  );
}

function BusinessHealth({ dashboard }: { dashboard: AiExecutiveCenterDashboard }) {
  const tone =
    dashboard.businessHealth.status === 'Excellent'
      ? 'emerald'
      : dashboard.businessHealth.status === 'Good'
        ? 'sky'
        : dashboard.businessHealth.status === 'Warning'
          ? 'amber'
          : 'rose';

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 sm:p-6">
      <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <div>
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Business Health</p>
              <div className="mt-2 text-5xl font-black text-white">{dashboard.businessHealth.score}</div>
            </div>
            <span className={`rounded-full border px-3 py-1 text-xs font-bold ${healthStyles[dashboard.businessHealth.status]}`}>
              {dashboard.businessHealth.status}
            </span>
          </div>
          <ScoreBar value={dashboard.businessHealth.score} tone={tone} />
          <p className="mt-4 text-sm leading-6 text-slate-300">{dashboard.businessHealth.summary}</p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {dashboard.businessHealth.components.map((component) => (
            <div key={component.key} className="rounded-xl border border-white/10 bg-black/10 p-4">
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="font-bold text-white">{component.label}</p>
                <span className="text-sm font-black text-slate-200">{component.score}</span>
              </div>
              <ScoreBar
                value={component.score}
                tone={component.status === 'Excellent' ? 'emerald' : component.status === 'Good' ? 'sky' : component.status === 'Warning' ? 'amber' : 'rose'}
              />
              <p className="mt-2 text-xs leading-5 text-slate-400">{component.detail}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function RiskBoard({ risks }: { risks: ExecutiveRiskItem[] }) {
  return (
    <div className="space-y-3">
      {risks.slice(0, 8).map((risk) => (
        <div key={risk.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <div className="mb-2 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h4 className="font-bold text-white">{risk.name}</h4>
              <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-slate-500">{risk.category.replace(/_/g, ' ')}</p>
            </div>
            <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase ${riskStyles[risk.riskLevel]}`}>
              {risk.riskLevel}
            </span>
          </div>
          <p className="text-sm leading-6 text-slate-300">{risk.detail}</p>
          <div className="mt-3 flex items-center justify-between gap-3 text-xs font-bold text-slate-500">
            <span>Risk score</span>
            <span>{risk.riskScore}</span>
          </div>
          <div className="mt-2">
            <ScoreBar value={risk.riskScore} tone={risk.riskScore >= 70 ? 'rose' : risk.riskScore >= 40 ? 'amber' : 'sky'} />
          </div>
        </div>
      ))}
      {risks.length === 0 && (
        <div className="rounded-2xl border border-dashed border-white/10 py-10 text-center text-sm text-slate-500">
          No elevated executive risks.
        </div>
      )}
    </div>
  );
}

function OpportunityBoard({ opportunities }: { opportunities: ExecutiveOpportunityItem[] }) {
  return (
    <div className="space-y-3">
      {opportunities.slice(0, 8).map((opportunity) => (
        <div key={opportunity.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <div className="mb-2 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h4 className="font-bold text-white">{opportunity.name}</h4>
              <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-slate-500">{opportunity.category.replace(/_/g, ' ')}</p>
            </div>
            <ArrowUpRight className="shrink-0 text-emerald-300" size={18} />
          </div>
          <p className="text-sm leading-6 text-slate-300">{opportunity.detail}</p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Score</div>
              <div className="mt-1 font-black text-white">{opportunity.opportunityScore}</div>
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Value</div>
              <div className="mt-1 font-black text-white">{formatCurrency(opportunity.estimatedValue)}</div>
            </div>
          </div>
          <p className="mt-3 text-sm font-semibold leading-6 text-emerald-100">{opportunity.recommendation}</p>
        </div>
      ))}
      {opportunities.length === 0 && (
        <div className="rounded-2xl border border-dashed border-white/10 py-10 text-center text-sm text-slate-500">
          No executive opportunities detected yet.
        </div>
      )}
    </div>
  );
}

function WorkforceList({ title, guards }: { title: string; guards: WorkforcePerformanceRow[] }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
      <h4 className="mb-4 font-bold text-white">{title}</h4>
      <div className="space-y-3">
        {guards.map((guard) => (
          <div key={guard.guardId} className="rounded-xl border border-white/10 bg-black/10 p-4">
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="font-bold text-white">{guard.name}</span>
              <span className="font-black text-slate-200">{guard.performanceScore}</span>
            </div>
            <ScoreBar value={guard.performanceScore} tone={guard.performanceScore >= 80 ? 'emerald' : guard.performanceScore >= 60 ? 'sky' : 'amber'} />
            <div className="mt-2 text-xs text-slate-500">
              {guard.attendanceRate === null ? 'N/A' : `${guard.attendanceRate}%`} attendance, {guard.missedShifts} missed, {guard.lateCheckIns} late
            </div>
          </div>
        ))}
        {guards.length === 0 && <div className="py-8 text-center text-sm text-slate-500">No guards in this group.</div>}
      </div>
    </div>
  );
}

function Recommendations({ recommendations }: { recommendations: AiRecommendation[] }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {recommendations.map((recommendation) => (
        <div key={recommendation.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h4 className="font-bold text-white">{recommendation.title}</h4>
              <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-slate-500">{recommendation.category}</p>
            </div>
            <span className={`rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wider ${priorityStyles[recommendation.priority]}`}>
              {recommendation.priority}
            </span>
          </div>
          <p className="text-sm font-semibold leading-6 text-slate-100">{recommendation.action}</p>
          <p className="mt-3 text-sm leading-6 text-slate-400">{recommendation.reason}</p>
          <AiFeedbackControl
            aiGenerationId={recommendation.aiGenerationId}
            recommendationId={recommendation.id}
            compact
          />
        </div>
      ))}
    </div>
  );
}

export default function AiExecutiveCenterPage() {
  const [dashboard, setDashboard] = useState<AiExecutiveCenterDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const data = await getExecutiveCenterDashboard();
      setDashboard(data);
      setError('');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not load AI Executive Center.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const topPredictions = useMemo(() => dashboard?.forecastsPredictions.topPredictions.slice(0, 4) || [], [dashboard]);

  return (
    <DashboardLayout allowedRoles={['admin']}>
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="flex items-center gap-3 text-2xl font-bold sm:text-3xl">
            <Briefcase className="text-sky-300" size={29} />
            AI Executive Center
          </h2>
          <p className="mt-2 text-slate-400">Strategic business health, risk priorities, opportunities, forecasts, and leadership actions.</p>
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
          Loading executive center...
        </div>
      ) : dashboard ? (
        <div className="space-y-10">
          <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 sm:p-6">
            <div className="mb-3 flex items-center gap-3">
              <BrainCircuit className="text-sky-300" size={22} />
              <h3 className="text-xl font-bold text-white">Executive Summary</h3>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-bold text-slate-300">
                {dashboard.source === 'ai_assisted' ? 'AI assisted' : 'Fallback'}
              </span>
            </div>
            <p className="text-base font-medium leading-7 text-slate-200 sm:text-lg">{dashboard.executiveSummary}</p>
            <AiFeedbackControl aiGenerationId={dashboard.aiGenerationId} compact />
          </section>

          <BusinessHealth dashboard={dashboard} />

          <section>
            <SectionHeader icon={TrendingUp} title="Revenue Growth Overview" />
            <MetricGrid metrics={dashboard.revenueGrowth.metrics} />
          </section>

          <section className="grid gap-6 xl:grid-cols-2">
            <div>
              <SectionHeader icon={FileWarning} title="Risk Priority Board" badge={`${dashboard.risks.length} risks`} />
              <RiskBoard risks={dashboard.risks} />
            </div>
            <div>
              <SectionHeader icon={ArrowUpRight} title="Opportunity Board" badge={`${dashboard.opportunities.length} opportunities`} />
              <OpportunityBoard opportunities={dashboard.opportunities} />
            </div>
          </section>

          <section>
            <SectionHeader icon={Users} title="Client Risk & Value" />
            <MetricGrid metrics={dashboard.clientRiskValue.metrics} />
          </section>

          <section>
            <SectionHeader icon={MapPin} title="Operations Risk" />
            <MetricGrid metrics={dashboard.operationsRisk.metrics} />
          </section>

          <section>
            <SectionHeader icon={ShieldCheck} title="Workforce Performance" />
            <MetricGrid metrics={dashboard.workforcePerformance.metrics} />
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <WorkforceList title="Best Performing Guards" guards={dashboard.workforcePerformance.bestGuards} />
              <WorkforceList title="Performance Watchlist" guards={dashboard.workforcePerformance.watchlistGuards} />
            </div>
          </section>

          <section>
            <SectionHeader icon={CalendarClock} title="Forecasts & Predictions" />
            <MetricGrid metrics={dashboard.forecastsPredictions.metrics} />
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              {topPredictions.map((prediction) => (
                <div key={prediction.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <h4 className="font-bold text-white">{prediction.title}</h4>
                      <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-slate-500">{prediction.category}</p>
                    </div>
                    <span className="font-black text-white">{prediction.probability}%</span>
                  </div>
                  <p className="text-sm leading-6 text-slate-300">{prediction.summary}</p>
                  <div className="mt-3">
                    <ScoreBar value={prediction.riskScore} tone={prediction.riskScore >= 70 ? 'rose' : prediction.riskScore >= 40 ? 'amber' : 'sky'} />
                  </div>
                </div>
              ))}
              {topPredictions.length === 0 && (
                <div className="rounded-2xl border border-dashed border-white/10 py-10 text-center text-sm text-slate-500 lg:col-span-2">
                  No elevated forecast or prediction signals.
                </div>
              )}
            </div>
          </section>

          <section>
            <SectionHeader icon={Lightbulb} title="Strategic AI Recommendations" badge={`${dashboard.recommendations.length} actions`} />
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
