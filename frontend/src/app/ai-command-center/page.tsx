'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import AiFeedbackControl from '@/components/AiFeedbackControl';
import DashboardLayout from '@/components/DashboardLayout';
import { getApiErrorMessage } from '@/lib/api-error';
import { useAuth } from '@/context/AuthContext';
import { getAiActions, RecommendationAction } from '@/lib/ai-actions';
import { CommandCenterDashboard, getCommandCenterDashboard } from '@/lib/command-center';
import {
  BrainCircuit,
  Command,
  Users,
  MapPin,
  ShieldCheck,
  FileWarning,
  Receipt,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Lightbulb,
  Clock,
  CalendarClock,
  Loader2,
  RefreshCcw,
  Sparkles,
  ClipboardCheck,
  ArrowRight
} from 'lucide-react';

const severityStyles = {
  positive: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
  info: 'text-sky-400 bg-sky-400/10 border-sky-400/20',
  warning: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
  critical: 'text-rose-400 bg-rose-400/10 border-rose-400/20',
};

const priorityStyles = {
  high: 'border-rose-400/25 bg-rose-400/10 text-rose-200',
  medium: 'border-amber-400/25 bg-amber-400/10 text-amber-200',
  low: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200',
};

const confidenceStyles = {
  high: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200',
  medium: 'border-sky-400/20 bg-sky-400/10 text-sky-200',
  low: 'border-rose-400/25 bg-rose-400/10 text-rose-200',
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function MetricCard({ title, value, detail, icon: Icon, tone = 'info' }: { 
  title: string, value: string | number, detail?: string, icon: any, tone?: keyof typeof severityStyles 
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 transition-all hover:bg-white/[0.06]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-slate-400">{title}</p>
        <div className={`rounded-xl p-2 ${severityStyles[tone]}`}>
          <Icon size={18} />
        </div>
      </div>
      <div className="break-words text-2xl font-black text-white sm:text-3xl">{value}</div>
      {detail && <div className="mt-2 text-xs font-medium text-slate-500">{detail}</div>}
    </div>
  );
}

function SectionHeader({ title, icon: Icon, badge }: { title: string, icon: any, badge?: string }) {
  return (
    <div className="mb-6 flex items-center gap-3">
      <div className="rounded-xl bg-indigo-500/10 p-2 border border-indigo-500/20">
        <Icon className="text-indigo-400" size={24} />
      </div>
      <h3 className="text-xl font-bold text-white sm:text-2xl">{title}</h3>
      {badge && (
        <span className="ml-2 rounded-full border border-indigo-400/20 bg-indigo-400/10 px-3 py-1 text-xs font-bold text-indigo-300">
          {badge}
        </span>
      )}
    </div>
  );
}

export default function AiCommandCenterPage() {
  const { user } = useAuth();
  const [dashboard, setDashboard] = useState<CommandCenterDashboard | null>(null);
  const [pendingActions, setPendingActions] = useState<RecommendationAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeRiskTab, setActiveRiskTab] = useState<'sites' | 'clients' | 'contracts'>('sites');

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const data = await getCommandCenterDashboard();
      const actions =
        user?.role === 'admin' ? (await getAiActions('pending')).actions : [];
      setDashboard(data);
      setPendingActions(actions);
      setError('');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not load AI Command Center.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadDashboard();
    }
  }, [user?.role]);

  return (
    <DashboardLayout allowedRoles={['admin', 'finance']}>
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="flex items-center gap-3 text-3xl font-black tracking-tight text-white sm:text-4xl">
            <div className="relative flex items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 p-3 shadow-lg shadow-indigo-500/20">
              <Command size={32} className="text-white" />
              <div className="absolute -right-1 -top-1">
                <span className="relative flex h-3 w-3">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500"></span>
                </span>
              </div>
            </div>
            AI Command Center
          </h2>
          <p className="mt-3 text-lg font-medium text-slate-400 max-w-2xl">
            Unified operational intelligence, automated risk detection, and financial forecasting.
          </p>
        </div>
        <button
          type="button"
          onClick={loadDashboard}
          disabled={loading}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm font-bold text-white transition-all hover:bg-white/10 hover:border-white/20 disabled:opacity-50"
        >
          {loading ? <Loader2 className="animate-spin" size={17} /> : <RefreshCcw size={17} />}
          Sync Data
        </button>
      </div>

      {error && (
        <div className="mb-8 flex items-center gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-5 py-4 text-sm font-semibold text-rose-300">
          <AlertTriangle size={18} />
          {error}
        </div>
      )}

      {loading && !dashboard ? (
        <div className="flex flex-col items-center justify-center py-32 text-center">
          <div className="relative mb-6">
            <div className="absolute inset-0 animate-ping rounded-full bg-indigo-500/20"></div>
            <BrainCircuit className="relative animate-pulse text-indigo-400" size={48} />
          </div>
          <p className="text-lg font-bold text-white">Aggregating intelligence...</p>
          <p className="mt-2 text-sm text-slate-400">Analyzing operations, finances, and workforce data</p>
        </div>
      ) : dashboard ? (
        <div className="space-y-12">
          
          {/* Daily AI Summary Section */}
          <section className="relative overflow-hidden rounded-3xl border border-indigo-500/20 bg-gradient-to-br from-indigo-500/10 via-slate-900/50 to-purple-500/10 p-1">
            <div className="absolute top-0 right-0 p-32 opacity-20 pointer-events-none">
               <Sparkles size={200} className="text-indigo-400 rotate-12 blur-3xl" />
            </div>
            <div className="relative rounded-[1.4rem] bg-slate-950/40 backdrop-blur-xl p-6 sm:p-8">
              <div className="flex flex-col md:flex-row gap-8 items-start">
                <div className="flex-1">
                  <div className="mb-4 flex items-center gap-2">
                    <Sparkles className="text-indigo-400" size={20} />
                    <h3 className="text-xl font-bold text-white">Daily AI Executive Briefing</h3>
                    <span className="ml-2 rounded-full border border-indigo-500/30 bg-indigo-500/20 px-2 py-0.5 text-xs font-bold text-indigo-300">
                      {dashboard.dailySummary.source === 'ai_assisted' ? 'Generated' : 'Fallback'}
                    </span>
                  </div>
                  <div className="prose prose-invert prose-indigo max-w-none">
                    <p className="text-lg leading-relaxed text-slate-300 font-medium">
                      {dashboard.dailySummary.aiNarrative}
                    </p>
                  </div>
                  {user?.role === 'admin' && (
                    <AiFeedbackControl aiGenerationId={dashboard.aiGenerationId} compact />
                  )}
                </div>
                <div className="w-full md:w-80 shrink-0 rounded-2xl border border-white/10 bg-white/5 p-5">
                  <h4 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-400">Top Priorities</h4>
                  <ul className="space-y-3">
                    {dashboard.dailySummary.topRecommendations.map((rec, i) => (
                      <li key={i} className="flex gap-3 text-sm font-medium text-slate-200">
                        <div className="mt-0.5 shrink-0 rounded-full bg-indigo-500/20 p-1">
                          <CheckCircle2 size={14} className="text-indigo-400" />
                        </div>
                        {rec}
                      </li>
                    ))}
                    {dashboard.dailySummary.topRecommendations.length === 0 && (
                      <li className="text-sm text-slate-500">No critical priorities today.</li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          </section>

          {/* Operations Overview */}
          <section>
            <SectionHeader title="Operations Overview" icon={TrendingUp} />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              <MetricCard 
                title="Active Clients" 
                value={dashboard.overview.activeClients} 
                detail={`${dashboard.overview.totalClients} total clients`}
                icon={Users}
                tone="info"
              />
              <MetricCard 
                title="Active Sites" 
                value={dashboard.overview.activeSites} 
                icon={MapPin}
                tone="info"
              />
              <MetricCard 
                title="Guards on Duty" 
                value={dashboard.overview.guardsOnDuty} 
                detail={`${dashboard.overview.totalGuards} total guards`}
                icon={ShieldCheck}
                tone={dashboard.overview.guardsOnDuty > 0 ? 'positive' : 'warning'}
              />
              <MetricCard 
                title="Open Incidents" 
                value={dashboard.overview.openIncidents} 
                icon={FileWarning}
                tone={dashboard.overview.openIncidents > 0 ? 'warning' : 'positive'}
              />
              <MetricCard 
                title="Forecasted Revenue" 
                value={formatCurrency(dashboard.overview.revenueForecast)} 
                detail="Next 30 days"
                icon={TrendingUp}
                tone="positive"
              />
              <MetricCard 
                title="Outstanding Invoices" 
                value={formatCurrency(dashboard.overview.outstandingAmount)} 
                detail={`${dashboard.overview.outstandingInvoices} unpaid invoices`}
                icon={Receipt}
                tone={dashboard.overview.outstandingAmount > 0 ? 'warning' : 'positive'}
              />
              <MetricCard 
                title="Staffing Alerts" 
                value={dashboard.overview.staffingAlerts} 
                detail={`${dashboard.overview.coverageGaps} coverage gaps`}
                icon={AlertTriangle}
                tone={dashboard.overview.staffingAlerts > 0 ? 'critical' : 'positive'}
              />
              <MetricCard
                title="Upcoming Shifts"
                value={dashboard.scheduling.totalUpcomingShifts}
                detail={`${dashboard.scheduling.fullyCoveredShifts} fully covered`}
                icon={CalendarClock}
                tone={dashboard.scheduling.coverageGaps > 0 ? 'warning' : 'positive'}
              />
            </div>
          </section>

          {user?.role === 'admin' && (
            <section>
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <SectionHeader title="Pending AI Actions" icon={ClipboardCheck} badge={`${pendingActions.length} pending`} />
                <Link
                  href="/ai-actions"
                  className="inline-flex min-h-10 w-fit items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-white transition hover:bg-white/10"
                >
                  Open AI Actions
                  <ArrowRight size={16} />
                </Link>
              </div>
              {pendingActions.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 py-10 text-center text-sm text-slate-500">
                  No pending AI actions.
                </div>
              ) : (
                <div className="grid gap-4 lg:grid-cols-3">
                  {pendingActions.slice(0, 3).map((action) => (
                    <Link
                      key={action.id}
                      href="/ai-actions"
                      className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 transition hover:bg-white/[0.07]"
                    >
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <h4 className="font-bold text-white">{action.title}</h4>
                        <span className="shrink-0 rounded-full border border-amber-400/25 bg-amber-400/10 px-2.5 py-1 text-[11px] font-bold uppercase text-amber-200">
                          Pending
                        </span>
                      </div>
                      <p className="line-clamp-2 text-sm leading-6 text-slate-400">
                        {action.description}
                      </p>
                      <div className="mt-4 text-xs font-bold uppercase tracking-wider text-slate-500">
                        {action.actionType.replace(/_/g, ' ')}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          )}

          <div className="grid gap-8 lg:grid-cols-2">
            {/* Risk Center */}
            <section>
              <SectionHeader 
                title="Risk Center" 
                icon={AlertTriangle} 
                badge={`${dashboard.risks.totalCritical} Critical`} 
              />
              <div className="rounded-2xl border border-white/10 bg-white/[0.02]">
                <div className="flex border-b border-white/10 p-2">
                  {(['sites', 'clients', 'contracts'] as const).map(tab => (
                    <button
                      key={tab}
                      onClick={() => setActiveRiskTab(tab)}
                      className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-bold capitalize transition-all ${
                        activeRiskTab === tab 
                          ? 'bg-white/10 text-white' 
                          : 'text-slate-400 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
                <div className="p-4">
                  {dashboard.risks[activeRiskTab].length === 0 ? (
                    <div className="py-8 text-center text-sm text-slate-500">No high risks detected for {activeRiskTab}.</div>
                  ) : (
                    <div className="space-y-3">
                      {dashboard.risks[activeRiskTab].map(risk => (
                        <div key={risk.id} className="flex items-center justify-between rounded-xl border border-white/5 bg-white/5 p-4">
                          <div>
                            <div className="flex items-center gap-3">
                              <h4 className="font-bold text-white">{risk.name}</h4>
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${severityStyles[risk.riskLevel === 'critical' ? 'critical' : risk.riskLevel === 'high' ? 'warning' : 'info']}`}>
                                {risk.riskLevel}
                              </span>
                            </div>
                            <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
                              <span>Risk Score: {risk.riskScore}</span>
                              <span>&bull;</span>
                              <span>{risk.incidentCount} incidents</span>
                            </div>
                          </div>
                          <div className="text-right text-xs">
                            {risk.indicators.slice(0, 1).map((ind, i) => (
                              <span key={i} className="text-slate-300">{ind}</span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* AI Recommendations */}
            <section>
              <SectionHeader title="Action Items" icon={Lightbulb} badge={`${dashboard.recommendations.length} items`} />
              <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                {dashboard.recommendations.map(rec => (
                  <div key={rec.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 transition hover:bg-white/[0.06]">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h4 className="font-bold text-white">{rec.title}</h4>
                        <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-slate-500">{rec.category}</p>
                      </div>
                      <span className={`shrink-0 rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wider ${priorityStyles[rec.priority]}`}>
                        {rec.priority}
                      </span>
                    </div>
                    {rec.confidence && (
                      <span className={`mb-3 inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase ${confidenceStyles[rec.confidence]}`}>
                        {rec.confidence} confidence
                      </span>
                    )}
                    <p className="text-sm font-semibold leading-relaxed text-indigo-100">{rec.action}</p>
                    <p className="mt-2 text-sm leading-relaxed text-slate-400">{rec.reason}</p>
                    {user?.role === 'admin' && (
                      <AiFeedbackControl
                        aiGenerationId={rec.aiGenerationId}
                        recommendationId={rec.id}
                        compact
                      />
                    )}
                  </div>
                ))}
                {dashboard.recommendations.length === 0 && (
                  <div className="py-12 text-center text-sm text-slate-500 rounded-2xl border border-dashed border-white/10">
                    No active recommendations. You are fully optimized.
                  </div>
                )}
              </div>
            </section>
          </div>

          <div className="flex items-center justify-center gap-2 pt-8 pb-4 text-xs font-medium text-slate-500">
            <Clock size={14} />
            Intelligence synced at {new Date(dashboard.generatedAt).toLocaleString()}
          </div>
        </div>
      ) : null}
    </DashboardLayout>
  );
}
