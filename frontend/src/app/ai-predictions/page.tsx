'use client';

import React, { useEffect, useState } from 'react';
import AiFeedbackControl from '@/components/AiFeedbackControl';
import DashboardLayout from '@/components/DashboardLayout';
import { getApiErrorMessage } from '@/lib/api-error';
import {
  BasePrediction,
  PredictionDashboard,
  PredictionRiskLevel,
  getPredictionDashboard,
} from '@/lib/ai-predictions';
import {
  AlertTriangle,
  BrainCircuit,
  CalendarClock,
  CheckCircle2,
  Clock,
  CreditCard,
  FileWarning,
  Lightbulb,
  Loader2,
  RefreshCcw,
  ShieldCheck,
  TrendingDown,
  Users,
} from 'lucide-react';

const riskStyles: Record<PredictionRiskLevel, string> = {
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

const priorityStyles = {
  high: 'border-rose-400/25 bg-rose-400/10 text-rose-200',
  medium: 'border-amber-400/25 bg-amber-400/10 text-amber-200',
  low: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200',
};

function MetricGrid({ dashboard }: { dashboard: PredictionDashboard }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {dashboard.summary.map((metric, index) => (
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

function SectionHeader({ icon: Icon, title, count }: { icon: typeof Users; title: string; count: number }) {
  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <Icon className="text-sky-300" size={22} />
        <h3 className="text-xl font-bold text-white sm:text-2xl">{title}</h3>
      </div>
      <span className="w-fit rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-bold text-slate-300">
        {count} signals
      </span>
    </div>
  );
}

function RiskBadge({ risk }: { risk: PredictionRiskLevel }) {
  return (
    <span className={`shrink-0 rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wider ${riskStyles[risk]}`}>
      {risk}
    </span>
  );
}

function ConfidenceBar({ value }: { value: number }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-xs font-bold text-slate-400">
        <span>Confidence</span>
        <span>{value}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className={`h-full rounded-full ${value >= 75 ? 'bg-emerald-400' : value >= 55 ? 'bg-sky-400' : 'bg-amber-400'}`}
          style={{ width: `${Math.max(4, value)}%` }}
        />
      </div>
    </div>
  );
}

function PredictionCard({ prediction }: { prediction: BasePrediction }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="font-bold text-white">{prediction.title}</h4>
          <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-slate-500">{prediction.timeframe}</p>
        </div>
        <RiskBadge risk={prediction.riskLevel} />
      </div>

      <p className="text-sm font-semibold leading-6 text-slate-100">{prediction.summary}</p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-black/10 p-4">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Probability</div>
          <div className="mt-2 text-2xl font-black text-white">{prediction.probability}%</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/10 p-4">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Risk Score</div>
          <div className="mt-2 text-2xl font-black text-white">{prediction.riskScore}</div>
        </div>
      </div>

      <div className="mt-4">
        <ConfidenceBar value={prediction.confidenceScore} />
      </div>

      <p className="mt-4 text-sm leading-6 text-slate-400">{prediction.explanation}</p>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {prediction.supportingData.slice(0, 6).map((item) => (
          <div key={`${prediction.id}-${item.label}`} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{item.label}</div>
            <div className="mt-1 break-words text-sm font-bold text-slate-100">{item.value}</div>
            {item.detail && <div className="mt-1 text-xs text-slate-500">{item.detail}</div>}
          </div>
        ))}
      </div>

      <div className="mt-4 space-y-2">
        {prediction.recommendations.slice(0, 2).map((recommendation, index) => (
          <div key={`${prediction.id}-rec-${index}`} className="flex gap-2 text-sm leading-6 text-slate-300">
            <Lightbulb className="mt-1 shrink-0 text-amber-300" size={15} />
            {recommendation}
          </div>
        ))}
      </div>
    </div>
  );
}

function PredictionSection({
  icon,
  title,
  predictions,
}: {
  icon: typeof Users;
  title: string;
  predictions: BasePrediction[];
}) {
  return (
    <section>
      <SectionHeader icon={icon} title={title} count={predictions.length} />
      <div className="grid gap-4 xl:grid-cols-2">
        {predictions.map((prediction) => (
          <PredictionCard key={prediction.id} prediction={prediction} />
        ))}
      </div>
    </section>
  );
}

function ActionItems({ dashboard }: { dashboard: PredictionDashboard }) {
  return (
    <section>
      <SectionHeader icon={Lightbulb} title="AI Recommendations" count={dashboard.recommendations.length} />
      <div className="grid gap-4 lg:grid-cols-2">
        {dashboard.recommendations.map((recommendation) => (
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
            {recommendation.confidence && (
              <div className="mt-3 text-xs font-bold uppercase tracking-wider text-slate-500">
                {recommendation.confidence} confidence
              </div>
            )}
            <AiFeedbackControl
              aiGenerationId={recommendation.aiGenerationId}
              recommendationId={recommendation.id}
              compact
            />
          </div>
        ))}
      </div>
    </section>
  );
}

export default function AiPredictionsPage() {
  const [dashboard, setDashboard] = useState<PredictionDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const data = await getPredictionDashboard();
      setDashboard(data);
      setError('');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not load AI predictions.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  return (
    <DashboardLayout allowedRoles={['admin']}>
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="flex items-center gap-3 text-2xl font-bold sm:text-3xl">
            <BrainCircuit className="text-sky-300" size={29} />
            AI Predictions
          </h2>
          <p className="mt-2 text-slate-400">Predictive operations intelligence across staffing, incidents, clients, payments, and renewals.</p>
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
          Loading predictions...
        </div>
      ) : dashboard ? (
        <div className="space-y-10">
          <section>
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <TrendingDown className="text-sky-300" size={22} />
                <h3 className="text-xl font-bold text-white sm:text-2xl">Overview</h3>
              </div>
              <span className="w-fit rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-bold text-slate-300">
                {dashboard.source === 'ai_assisted' ? 'AI assisted' : 'Rule based'}
              </span>
            </div>
            <AiFeedbackControl aiGenerationId={dashboard.aiGenerationId} compact />
            <MetricGrid dashboard={dashboard} />
          </section>

          <PredictionSection icon={ShieldCheck} title="Staffing Predictions" predictions={dashboard.staffing.predictions} />
          <PredictionSection icon={FileWarning} title="Incident Predictions" predictions={dashboard.incidents.predictions} />
          <PredictionSection icon={Users} title="Churn Predictions" predictions={dashboard.churn.predictions} />
          <PredictionSection icon={CreditCard} title="Payment Risk" predictions={dashboard.payments.predictions} />
          <PredictionSection icon={CalendarClock} title="Renewal Risk" predictions={dashboard.renewals.predictions} />
          <ActionItems dashboard={dashboard} />

          <div className="flex items-center gap-2 pb-2 text-sm text-slate-500">
            <Clock size={15} />
            Generated {new Date(dashboard.generatedAt).toLocaleString()}
          </div>
        </div>
      ) : null}
    </DashboardLayout>
  );
}
