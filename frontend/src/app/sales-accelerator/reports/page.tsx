'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';
import { getApiErrorMessage } from '@/lib/api-error';
import {
  getSalesAlerts,
  getSalesCoachingAnalytics,
  getSalesForecastReport,
  getSalesLearningLoop,
} from '@/lib/sales-accelerator';
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  BrainCircuit,
  Loader2,
  RefreshCw,
  TrendingUp,
  Users,
} from 'lucide-react';

type ReportTab = 'alerts' | 'forecast' | 'coaching' | 'learning';

const severityClass = (severity?: string) => {
  if (severity === 'critical') return 'border-rose-400/30 bg-rose-400/10 text-rose-300';
  if (severity === 'high') return 'border-amber-400/30 bg-amber-400/10 text-amber-300';
  if (severity === 'medium') return 'border-cyan-400/30 bg-cyan-400/10 text-cyan-300';
  return 'border-white/10 bg-white/5 text-slate-300';
};

const statusClass = (status?: string) => {
  if (['commit', 'likely', 'healthy', 'strong'].includes(status || '')) return 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300';
  if (['watch', 'learning'].includes(status || '')) return 'border-cyan-400/30 bg-cyan-400/10 text-cyan-300';
  if (['at_risk', 'risk', 'stalled'].includes(status || '')) return 'border-amber-400/30 bg-amber-400/10 text-amber-300';
  if (['urgent', 'oversold', 'closed_lost'].includes(status || '')) return 'border-rose-400/30 bg-rose-400/10 text-rose-300';
  return 'border-white/10 bg-white/5 text-slate-300';
};

const formatScore = (value: unknown) => typeof value === 'number' ? value : '--';

export default function SalesAcceleratorReportsPage() {
  const [activeTab, setActiveTab] = useState<ReportTab>('alerts');
  const [alerts, setAlerts] = useState<any | null>(null);
  const [forecast, setForecast] = useState<any | null>(null);
  const [coaching, setCoaching] = useState<any | null>(null);
  const [learning, setLearning] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [alertsData, forecastData, coachingData, learningData] = await Promise.all([
        getSalesAlerts(),
        getSalesForecastReport(),
        getSalesCoachingAnalytics(),
        getSalesLearningLoop(),
      ]);
      setAlerts(alertsData);
      setForecast(forecastData);
      setCoaching(coachingData);
      setLearning(learningData);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not load sales accelerator reports.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const metrics = useMemo(() => [
    { label: 'Open Alerts', value: alerts?.summary?.total ?? 0, icon: AlertTriangle },
    { label: 'Critical', value: alerts?.summary?.critical ?? 0, icon: AlertTriangle },
    { label: 'Forecast Risk', value: forecast?.summary?.forecastRiskDeals ?? 0, icon: TrendingUp },
    { label: 'Avg Confidence', value: formatScore(forecast?.summary?.averageForecastConfidence), icon: BarChart3 },
    { label: 'Missing Discovery', value: coaching?.metrics?.missingDiscovery ?? 0, icon: Users },
    { label: 'Learning Risk', value: learning?.summary?.riskDeals ?? 0, icon: BookOpen },
  ], [alerts, coaching, forecast, learning]);

  return (
    <DashboardLayout requiredPermissions="ai.view">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="flex items-center gap-3 text-2xl font-bold sm:text-3xl">
            <BarChart3 className="text-indigo-300" size={28} />
            Sales Execution Reports
          </h2>
          <p className="mt-2 text-muted-foreground">Alerts, forecast confidence, coaching analytics, and post-close learning</p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-sky-400/20 bg-sky-400/10 px-5 py-3 text-sm font-bold text-sky-300 transition hover:bg-sky-400/20 disabled:opacity-60"
        >
          {loading ? <Loader2 className="animate-spin" size={17} /> : <RefreshCw size={18} />}
          Refresh
        </button>
      </div>

      {error && <div className="mb-6 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-300">{error}</div>}

      {loading ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] py-24 text-center text-slate-500">
          <Loader2 className="mx-auto mb-3 animate-spin text-indigo-300" size={28} />
          Loading reports...
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
            {metrics.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="text-xs font-bold uppercase tracking-widest text-slate-500">{item.label}</div>
                    <Icon size={17} className="text-indigo-300" />
                  </div>
                  <div className="text-2xl font-black text-white">{item.value}</div>
                </div>
              );
            })}
          </div>

          <div className="grid gap-2 rounded-xl border border-white/10 bg-black/20 p-1 sm:grid-cols-4">
            {[
              { key: 'alerts', label: 'Alerts' },
              { key: 'forecast', label: 'Forecast' },
              { key: 'coaching', label: 'Coaching' },
              { key: 'learning', label: 'Learning' },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key as ReportTab)}
                className={`min-h-10 rounded-lg px-3 text-sm font-bold transition ${activeTab === tab.key ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'alerts' && (
            <section className="rounded-xl border border-white/10 bg-white/[0.04] p-4 sm:p-6">
              <h3 className="mb-5 flex items-center gap-2 text-xl font-bold"><AlertTriangle className="text-rose-300" size={22} /> Internal Alerts</h3>
              <div className="grid gap-3">
                {(alerts?.alerts || []).map((alert: any) => (
                  <Link key={alert.id} href={alert.href} className="rounded-xl border border-white/10 bg-slate-950/20 p-4 transition hover:bg-white/[0.06]">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="font-bold text-white">{alert.title}</div>
                        <div className="mt-1 text-sm text-slate-400">{alert.subject}</div>
                        <p className="mt-3 text-sm leading-6 text-slate-300">{alert.recommendedAction}</p>
                        <div className="mt-2 text-xs text-slate-500">{alert.reason}</div>
                      </div>
                      <span className={`w-fit rounded-full border px-3 py-1 text-xs font-black uppercase tracking-widest ${severityClass(alert.severity)}`}>{alert.severity}</span>
                    </div>
                  </Link>
                ))}
                {(alerts?.alerts || []).length === 0 && <div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-500">No alerts right now.</div>}
              </div>
            </section>
          )}

          {activeTab === 'forecast' && (
            <section className="rounded-xl border border-white/10 bg-white/[0.04] p-4 sm:p-6">
              <h3 className="mb-5 flex items-center gap-2 text-xl font-bold"><TrendingUp className="text-cyan-300" size={22} /> Leadership Forecast</h3>
              <div className="grid gap-3">
                {(forecast?.deals || []).map((deal: any) => (
                  <Link key={deal.id} href={deal.href} className="rounded-xl border border-white/10 bg-slate-950/20 p-4 transition hover:bg-white/[0.06]">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="font-bold text-white">{deal.name}</div>
                        <div className="mt-1 text-sm text-slate-400">{deal.company} | {deal.stage}</div>
                        <p className="mt-3 text-sm leading-6 text-slate-300">{deal.recommendedAction}</p>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                          <span>{deal.forecast.probability}% probability</span>
                          <span>{deal.forecast.confidence}% confidence</span>
                          <span>{formatScore(deal.readiness)} readiness</span>
                        </div>
                      </div>
                      <span className={`w-fit rounded-full border px-3 py-1 text-xs font-black uppercase tracking-widest ${statusClass(deal.forecast.status)}`}>{deal.forecast.label}</span>
                    </div>
                  </Link>
                ))}
                {(forecast?.deals || []).length === 0 && <div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-500">No forecast risks right now.</div>}
              </div>
            </section>
          )}

          {activeTab === 'coaching' && (
            <section className="rounded-xl border border-white/10 bg-white/[0.04] p-4 sm:p-6">
              <h3 className="mb-5 flex items-center gap-2 text-xl font-bold"><Users className="text-emerald-300" size={22} /> Rep Coaching</h3>
              <div className="grid gap-4 lg:grid-cols-2">
                {(coaching?.reps || []).map((rep: any) => (
                  <div key={rep.repId} className="rounded-xl border border-white/10 bg-slate-950/20 p-4">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div>
                        <div className="font-bold text-white">{rep.name}</div>
                        <div className="mt-1 text-sm text-slate-400">{rep.discoveryCount} discoveries | {rep.assessmentCount} assessments</div>
                      </div>
                      <span className="rounded-full border border-indigo-400/30 bg-indigo-400/10 px-3 py-1 text-xs font-black text-indigo-200">{rep.coachingScore}</span>
                    </div>
                    <p className="text-sm leading-6 text-slate-300">{rep.recommendedAction}</p>
                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-lg bg-white/5 p-3 text-slate-400">Discovery <span className="font-bold text-white">{formatScore(rep.averageDiscoveryQuality)}</span></div>
                      <div className="rounded-lg bg-white/5 p-3 text-slate-400">Readiness <span className="font-bold text-white">{formatScore(rep.averageCloseReadiness)}</span></div>
                      <div className="rounded-lg bg-white/5 p-3 text-slate-400">Risk capture <span className="font-bold text-white">{formatScore(rep.riskCoverage)}</span></div>
                      <div className="rounded-lg bg-white/5 p-3 text-slate-400">Objections <span className="font-bold text-white">{rep.objectionSignals}</span></div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {activeTab === 'learning' && (
            <section className="rounded-xl border border-white/10 bg-white/[0.04] p-4 sm:p-6">
              <h3 className="mb-5 flex items-center gap-2 text-xl font-bold"><BrainCircuit className="text-indigo-300" size={22} /> Post-Close Learning Loop</h3>
              <div className="mb-6 grid gap-3 lg:grid-cols-2">
                {(learning?.recommendedPlaybookUpdates || []).map((item: any, index: number) => (
                  <div key={`${item.type}-${index}`} className="rounded-xl border border-white/10 bg-slate-950/20 p-4">
                    <div className="text-xs font-black uppercase tracking-widest text-indigo-300">{item.type.replace(/_/g, ' ')}</div>
                    <div className="mt-2 font-bold text-white">{item.title}</div>
                    <p className="mt-3 text-sm leading-6 text-slate-300">{item.recommendation}</p>
                    <div className="mt-2 text-xs text-slate-500">{item.support}</div>
                  </div>
                ))}
              </div>
              <div className="grid gap-3">
                {(learning?.learnings || []).map((item: any) => (
                  <Link key={item.id} href={item.href} className="rounded-xl border border-white/10 bg-slate-950/20 p-4 transition hover:bg-white/[0.06]">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="font-bold text-white">{item.name}</div>
                        <div className="mt-1 text-sm text-slate-400">{item.company}</div>
                        <p className="mt-3 text-sm leading-6 text-slate-300">{item.proposalWarning}</p>
                      </div>
                      <span className={`w-fit rounded-full border px-3 py-1 text-xs font-black uppercase tracking-widest ${statusClass(item.status)}`}>{item.status}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </DashboardLayout>
  );
}
