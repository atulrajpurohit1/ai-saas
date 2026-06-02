'use client';

import React, { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { getApiErrorMessage } from '@/lib/api-error';
import { AiMonitoringMetrics, getAiMonitoring } from '@/lib/ai-monitoring';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Gauge,
  Loader2,
  MessageSquare,
  RefreshCcw,
  ShieldCheck,
  Star,
  ThumbsUp,
  XCircle,
} from 'lucide-react';

function formatPercent(value: number) {
  return `${value}%`;
}

function formatNumber(value: number | null) {
  return value === null ? 'N/A' : value.toString();
}

function MetricCard({
  label,
  value,
  detail,
  tone = 'info',
  icon: Icon,
}: {
  label: string;
  value: string | number;
  detail?: string;
  tone?: 'info' | 'positive' | 'warning' | 'critical';
  icon: React.ElementType;
}) {
  const iconClass =
    tone === 'positive'
      ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
      : tone === 'warning'
        ? 'border-amber-400/20 bg-amber-400/10 text-amber-300'
        : tone === 'critical'
          ? 'border-rose-400/20 bg-rose-400/10 text-rose-300'
          : 'border-sky-400/20 bg-sky-400/10 text-sky-300';

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-slate-400">{label}</p>
        <span className={`rounded-xl border p-2 ${iconClass}`}>
          <Icon size={17} />
        </span>
      </div>
      <div className="text-2xl font-black text-white sm:text-3xl">{value}</div>
      {detail && <div className="mt-2 text-sm text-slate-500">{detail}</div>}
    </div>
  );
}

function SectionHeader({ title, icon: Icon }: { title: string; icon: React.ElementType }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <Icon className="text-sky-300" size={22} />
      <h3 className="text-xl font-bold text-white sm:text-2xl">{title}</h3>
    </div>
  );
}

export default function AiMonitoringPage() {
  const [metrics, setMetrics] = useState<AiMonitoringMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadMetrics = async () => {
    setLoading(true);
    try {
      const data = await getAiMonitoring();
      setMetrics(data);
      setError('');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not load AI monitoring.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMetrics();
  }, []);

  return (
    <DashboardLayout allowedRoles={['admin']}>
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="flex items-center gap-3 text-2xl font-bold sm:text-3xl">
            <Gauge className="text-sky-300" size={30} />
            AI Monitoring
          </h2>
          <p className="mt-2 text-slate-400">AI output quality, feedback, actions, and fallback dependency.</p>
        </div>
        <button
          type="button"
          onClick={loadMetrics}
          disabled={loading}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/10 disabled:opacity-60"
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

      {loading && !metrics ? (
        <div className="py-24 text-center text-slate-400">
          <Loader2 className="mx-auto mb-3 animate-spin text-sky-300" size={28} />
          Loading AI monitoring...
        </div>
      ) : metrics ? (
        <div className="space-y-10">
          <section>
            <SectionHeader title="Generation Health" icon={BarChart3} />
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="Total AI generations" value={metrics.totals.totalAiGenerations} icon={Activity} />
              <MetricCard label="AI success" value={metrics.totals.aiSuccessCount} icon={CheckCircle2} tone="positive" />
              <MetricCard label="AI failures" value={metrics.totals.aiFailureCount} icon={XCircle} tone={metrics.totals.aiFailureCount > 0 ? 'critical' : 'positive'} />
              <MetricCard label="Fallback usage" value={metrics.totals.fallbackUsageCount} icon={AlertTriangle} tone={metrics.totals.fallbackUsageCount > 0 ? 'warning' : 'positive'} />
            </div>
          </section>

          <section>
            <SectionHeader title="Feedback Quality" icon={MessageSquare} />
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="Average rating" value={formatNumber(metrics.totals.averageFeedbackRating)} detail={`${metrics.totals.totalFeedback} feedback records`} icon={Star} tone="positive" />
              <MetricCard label="Accuracy rate" value={formatPercent(metrics.quality.accuracyRate)} icon={ShieldCheck} tone={metrics.quality.accuracyRate >= 70 ? 'positive' : 'warning'} />
              <MetricCard label="Usefulness rate" value={formatPercent(metrics.quality.usefulnessRate)} icon={ThumbsUp} tone={metrics.quality.usefulnessRate >= 70 ? 'positive' : 'warning'} />
              <MetricCard label="Fallback dependency" value={formatPercent(metrics.quality.fallbackDependencyRate)} icon={AlertTriangle} tone={metrics.quality.fallbackDependencyRate > 30 ? 'warning' : 'info'} />
            </div>
          </section>

          <section>
            <SectionHeader title="Recommendation Outcomes" icon={CheckCircle2} />
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="Accepted recommendations" value={metrics.totals.acceptedRecommendations} icon={CheckCircle2} tone="positive" />
              <MetricCard label="Rejected recommendations" value={metrics.totals.rejectedRecommendations} icon={XCircle} tone={metrics.totals.rejectedRecommendations > 0 ? 'warning' : 'positive'} />
              <MetricCard label="Action approval rate" value={formatPercent(metrics.quality.actionApprovalRate)} icon={ShieldCheck} tone="info" />
              <MetricCard label="Execution success rate" value={formatPercent(metrics.quality.actionExecutionSuccessRate)} icon={Activity} tone={metrics.quality.actionExecutionSuccessRate >= 70 ? 'positive' : 'warning'} />
            </div>
          </section>

          <section>
            <SectionHeader title="Source Modules" icon={Activity} />
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
              <div className="overflow-x-auto">
                <table className="responsive-table w-full text-left">
                  <thead>
                    <tr className="border-b border-white/5 text-xs uppercase tracking-wider text-slate-500">
                      <th className="px-5 py-4 font-semibold">Module</th>
                      <th className="px-5 py-4 font-semibold">Total</th>
                      <th className="px-5 py-4 font-semibold">Success</th>
                      <th className="px-5 py-4 font-semibold">Failed</th>
                      <th className="px-5 py-4 font-semibold">Fallback</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {metrics.sourceModuleBreakdown.map((row) => (
                      <tr key={row.sourceModule} className="text-sm text-slate-300">
                        <td className="px-5 py-4 font-bold text-white" data-label="Module">{row.sourceModule}</td>
                        <td className="px-5 py-4" data-label="Total">{row.total}</td>
                        <td className="px-5 py-4 text-emerald-200" data-label="Success">{row.success}</td>
                        <td className="px-5 py-4 text-rose-200" data-label="Failed">{row.failed}</td>
                        <td className="px-5 py-4 text-amber-200" data-label="Fallback">{row.fallbackUsed || row.fallback}</td>
                      </tr>
                    ))}
                    {metrics.sourceModuleBreakdown.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-5 py-10 text-center text-sm text-slate-500">No AI generations logged yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section>
            <SectionHeader title="Recent Feedback" icon={MessageSquare} />
            <div className="grid gap-4 lg:grid-cols-2">
              {metrics.recentFeedback.map((item) => (
                <div key={item.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <div className="font-bold text-white">{item.sourceModule}</div>
                      <div className="mt-1 text-xs text-slate-500">{new Date(item.createdAt).toLocaleString()}</div>
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/20 bg-amber-400/10 px-2.5 py-1 text-xs font-bold text-amber-200">
                      <Star size={13} fill="currentColor" />
                      {item.rating}
                    </span>
                  </div>
                  <div className="mb-3 flex flex-wrap gap-2 text-xs font-bold">
                    <span className={`rounded-full border px-2.5 py-1 ${item.isUseful ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200' : 'border-rose-400/20 bg-rose-400/10 text-rose-200'}`}>
                      {item.isUseful ? 'Useful' : 'Not useful'}
                    </span>
                    <span className={`rounded-full border px-2.5 py-1 ${item.isAccurate ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200' : 'border-rose-400/20 bg-rose-400/10 text-rose-200'}`}>
                      {item.isAccurate ? 'Accurate' : 'Inaccurate'}
                    </span>
                  </div>
                  <p className="text-sm leading-6 text-slate-300">{item.feedbackText || 'No comment.'}</p>
                </div>
              ))}
              {metrics.recentFeedback.length === 0 && (
                <div className="rounded-2xl border border-dashed border-white/10 py-14 text-center text-sm text-slate-500 lg:col-span-2">
                  No feedback submitted yet.
                </div>
              )}
            </div>
          </section>
        </div>
      ) : null}
    </DashboardLayout>
  );
}
