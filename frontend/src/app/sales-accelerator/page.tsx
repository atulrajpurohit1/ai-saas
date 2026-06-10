'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';
import api from '@/lib/api';
import {
  AlertTriangle,
  BrainCircuit,
  Briefcase,
  Clock3,
  Loader2,
  Target,
  TrendingUp,
  Users,
} from 'lucide-react';

interface Assessment {
  id: string;
  leadScore: number | null;
  priorityTier: string | null;
  closeReadinessScore: number | null;
  discoveryQualityScore?: number | null;
  riskProfile?: string | null;
  proposalAngle?: string | null;
  recommendedNextAction: string | null;
  summary?: string | null;
  createdAt: string;
}

interface DashboardLead {
  id: string;
  name: string;
  company: string;
  status: string;
  assessment: Assessment | null;
}

interface ActivitySnapshot {
  id: string;
  type: string;
  subject: string;
  status: string;
  dueDate: string | null;
  createdAt: string;
}

interface DealMomentum {
  status: 'healthy' | 'watch' | 'stalled' | 'urgent' | 'closed';
  score: number;
  daysOpen: number;
  daysSinceActivity: number | null;
  overdueActivityCount: number;
  pendingActivityCount: number;
  nextActivity: ActivitySnapshot | null;
  lastActivity: ActivitySnapshot | null;
  reasons: string[];
  recommendedAction: string;
}

interface ForecastHistoryPoint {
  id: string;
  score: number | null;
  discoveryQualityScore: number | null;
  createdAt: string;
}

interface DealForecast {
  status: 'commit' | 'likely' | 'watch' | 'at_risk' | 'unscored' | 'closed_won' | 'closed_lost';
  label: string;
  confidence: number;
  probability: number;
  currentReadiness: number | null;
  previousReadiness: number | null;
  readinessChange: number | null;
  trend: 'improving' | 'flat' | 'declining' | 'unknown';
  history: ForecastHistoryPoint[];
  reasons: string[];
  recommendedAction: string;
}

interface ObjectionPattern {
  key: string;
  label: string;
  count: number;
  severity: 'high' | 'medium' | 'low';
  examples: string[];
  recommendedResponse: string;
  playbook: string[];
  relatedLeads: Array<{
    id: string;
    name: string;
    company: string;
    status: string;
  }>;
  relatedDeals: Array<{
    id: string;
    name: string;
    stage: string;
    company: string;
  }>;
}

interface DashboardDeal {
  id: string;
  name: string;
  stage: string;
  lead: { id: string; name: string; company: string };
  client: { id: string; name: string; companyName: string | null } | null;
  assessment: Assessment | null;
  momentum: DealMomentum;
  forecast: DealForecast;
}

interface RecentAssessment extends Assessment {
  assessmentType: string;
  lead: { id: string; name: string; company: string } | null;
  deal: { id: string; name: string; stage: string } | null;
}

interface MissingDiscoveryLead {
  id: string;
  name: string;
  company: string;
  status: string;
  createdAt: string;
}

interface MissingDiscoveryDeal {
  id: string;
  name: string;
  stage: string;
  createdAt: string;
  lead: { id: string; name: string; company: string };
}

interface SalesDashboard {
  generatedAt: string;
  metrics: {
    totalLeads: number;
    totalDeals: number;
    assessedLeads: number;
    assessedDeals: number;
    highPriorityLeads: number;
    dealsBelowReadiness: number;
    stalledDeals: number;
    overdueDealActivities: number;
    trackedObjections: number;
    objectionPatternCount: number;
    forecastAtRiskDeals: number;
    averageForecastConfidence: number | null;
    leadsMissingDiscovery: number;
    dealsMissingDiscovery: number;
    averageLeadScore: number | null;
    averageCloseReadiness: number | null;
  };
  topLeads: DashboardLead[];
  atRiskDeals: DashboardDeal[];
  stalledDeals: DashboardDeal[];
  forecastRiskDeals: DashboardDeal[];
  objectionPatterns: ObjectionPattern[];
  missingDiscoveryLeads: MissingDiscoveryLead[];
  missingDiscoveryDeals: MissingDiscoveryDeal[];
  recentAssessments: RecentAssessment[];
}

type FocusMode = 'priority' | 'risk' | 'momentum' | 'forecast' | 'missing';

const scoreClass = (score?: number | null) => {
  if ((score || 0) >= 75) return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300';
  if ((score || 0) >= 50) return 'border-amber-500/20 bg-amber-500/10 text-amber-300';
  if (typeof score === 'number') return 'border-rose-500/20 bg-rose-500/10 text-rose-300';
  return 'border-white/10 bg-white/5 text-slate-500';
};

const momentumClass = (status?: DealMomentum['status']) => {
  if (status === 'healthy') return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300';
  if (status === 'watch') return 'border-cyan-500/20 bg-cyan-500/10 text-cyan-300';
  if (status === 'stalled') return 'border-amber-500/20 bg-amber-500/10 text-amber-300';
  if (status === 'urgent') return 'border-rose-500/20 bg-rose-500/10 text-rose-300';
  return 'border-white/10 bg-white/5 text-slate-500';
};

const forecastClass = (status?: DealForecast['status']) => {
  if (status === 'commit' || status === 'closed_won') return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300';
  if (status === 'likely') return 'border-cyan-500/20 bg-cyan-500/10 text-cyan-300';
  if (status === 'watch') return 'border-amber-500/20 bg-amber-500/10 text-amber-300';
  if (status === 'at_risk' || status === 'closed_lost') return 'border-rose-500/20 bg-rose-500/10 text-rose-300';
  return 'border-white/10 bg-white/5 text-slate-500';
};

const severityClass = (severity?: ObjectionPattern['severity']) => {
  if (severity === 'high') return 'border-rose-500/20 bg-rose-500/10 text-rose-300';
  if (severity === 'medium') return 'border-amber-500/20 bg-amber-500/10 text-amber-300';
  return 'border-cyan-500/20 bg-cyan-500/10 text-cyan-300';
};

const formatScore = (score?: number | null) => typeof score === 'number' ? score : '--';

export default function SalesAcceleratorDashboardPage() {
  const [dashboard, setDashboard] = useState<SalesDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [focusMode, setFocusMode] = useState<FocusMode>('priority');

  useEffect(() => {
    const fetchDashboard = async () => {
      setLoading(true);
      setError('');

      try {
        const response = await api.get('sales-accelerator/dashboard');
        setDashboard(response.data);
      } catch (err) {
        console.error('Failed to load sales accelerator dashboard', err);
        setError('Could not load Sales Accelerator dashboard.');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, []);

  const metrics = dashboard?.metrics;
  const focusItems = dashboard
    ? focusMode === 'priority'
      ? dashboard.topLeads.map((lead) => ({
          id: lead.id,
          title: lead.company,
          subtitle: lead.name,
          href: `/leads/${lead.id}`,
          score: lead.assessment?.leadScore,
          label: lead.assessment?.priorityTier || 'priority',
          nextAction: lead.assessment?.recommendedNextAction || 'Open lead details to improve discovery.',
        }))
      : focusMode === 'risk'
        ? dashboard.atRiskDeals.map((deal) => ({
            id: deal.id,
            title: deal.name,
            subtitle: deal.lead.company,
            href: `/deals/${deal.id}`,
            score: deal.assessment?.closeReadinessScore,
            label: 'readiness',
            nextAction: deal.assessment?.recommendedNextAction || 'Open deal details to improve readiness.',
          }))
        : focusMode === 'momentum'
          ? dashboard.stalledDeals.map((deal) => ({
              id: deal.id,
              title: deal.name,
              subtitle: `${deal.lead.company} - ${deal.momentum.status}`,
              href: `/deals/${deal.id}`,
              score: deal.momentum.score,
              label: 'momentum',
              nextAction: deal.momentum.recommendedAction,
            }))
          : focusMode === 'forecast'
            ? dashboard.forecastRiskDeals.map((deal) => ({
                id: deal.id,
                title: deal.name,
                subtitle: `${deal.lead.company} - ${deal.forecast.label}`,
                href: `/deals/${deal.id}`,
                score: deal.forecast.confidence,
                label: 'forecast confidence',
                nextAction: deal.forecast.recommendedAction,
              }))
        : [
            ...dashboard.missingDiscoveryLeads.map((lead) => ({
              id: `lead-${lead.id}`,
              title: lead.company,
              subtitle: `${lead.name} - Lead`,
              href: `/leads/${lead.id}`,
              score: null,
              label: 'missing discovery',
              nextAction: 'Capture discovery details and run scoring.',
            })),
            ...dashboard.missingDiscoveryDeals.map((deal) => ({
              id: `deal-${deal.id}`,
              title: deal.name,
              subtitle: `${deal.lead.company} - Deal`,
              href: `/deals/${deal.id}`,
              score: null,
              label: 'missing discovery',
              nextAction: 'Capture discovery details and run close-readiness scoring.',
            })),
          ]
    : [];

  return (
    <DashboardLayout>
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-cyan-300">
            <BrainCircuit size={14} />
            Security Sales Execution
          </div>
          <h2 className="text-2xl font-bold sm:text-3xl">Sales Accelerator</h2>
          <p className="text-muted-foreground">Prioritize the right deals, tighten discovery, and move proposals from risk to value.</p>
        </div>
        <Link
          href="/leads"
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-bold text-white shadow-lg transition hover:bg-indigo-500 sm:w-auto"
        >
          <Target size={18} />
          Score Leads
        </Link>
      </div>

      {loading ? (
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] py-24 text-center text-slate-500">
          <Loader2 className="mx-auto mb-3 animate-spin text-cyan-300" size={28} />
          Loading sales intelligence...
        </div>
      ) : error || !dashboard || !metrics ? (
        <div className="rounded-3xl border border-rose-500/20 bg-rose-500/10 p-6 text-rose-300">
          {error || 'Sales Accelerator data is unavailable.'}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              { label: 'Avg Lead Score', value: formatScore(metrics.averageLeadScore), icon: Users },
              { label: 'Avg Readiness', value: formatScore(metrics.averageCloseReadiness), icon: TrendingUp },
              { label: 'High Priority', value: metrics.highPriorityLeads, icon: Target },
              { label: 'At Risk Deals', value: metrics.dealsBelowReadiness, icon: AlertTriangle },
              { label: 'Stalled Deals', value: metrics.stalledDeals, icon: Clock3 },
              { label: 'Overdue Tasks', value: metrics.overdueDealActivities, icon: AlertTriangle },
              { label: 'Objections', value: metrics.trackedObjections, icon: AlertTriangle },
              { label: 'Forecast Risk', value: metrics.forecastAtRiskDeals, icon: TrendingUp },
              { label: 'Forecast Conf.', value: formatScore(metrics.averageForecastConfidence), icon: Target },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div className="text-xs font-bold uppercase tracking-widest text-slate-500">{item.label}</div>
                    <Icon size={18} className="text-cyan-300" />
                  </div>
                  <div className="text-3xl font-extrabold text-white">{item.value}</div>
                </div>
              );
            })}
          </div>

          <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 sm:p-6">
            <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="text-lg font-bold">Focus Queue</h3>
                <p className="mt-1 text-sm text-slate-500">Switch views to decide what sales should work next.</p>
              </div>
              <div className="grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-black/20 p-1 sm:grid-cols-5">
                {[
                  { key: 'priority', label: 'Priority' },
                  { key: 'risk', label: 'At Risk' },
                  { key: 'momentum', label: 'Momentum' },
                  { key: 'forecast', label: 'Forecast' },
                  { key: 'missing', label: 'Discovery' },
                ].map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setFocusMode(item.key as FocusMode)}
                    className={`rounded-xl px-3 py-2 text-xs font-bold uppercase tracking-widest transition ${
                      focusMode === item.key
                        ? 'bg-primary text-white'
                        : 'text-slate-500 hover:bg-white/5 hover:text-slate-200'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {focusItems.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 py-10 text-center text-sm text-slate-500">
                No records in this focus view.
              </div>
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                {focusItems.map((item) => (
                  <Link
                    key={item.id}
                    href={item.href}
                    className="rounded-2xl border border-white/10 bg-black/20 p-4 transition hover:border-cyan-400/30 hover:bg-white/[0.06]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-bold text-white">{item.title}</div>
                        <div className="mt-1 truncate text-sm text-slate-400">{item.subtitle}</div>
                      </div>
                      <span className={`shrink-0 rounded-full border px-3 py-1 text-xs font-bold ${scoreClass(item.score)}`}>
                        {item.score === null || item.score === undefined ? '--' : item.score}
                      </span>
                    </div>
                    <div className="mt-3 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                      {item.label}
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-400">{item.nextAction}</p>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <div className="grid gap-6 xl:grid-cols-4">
            <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 sm:p-6">
              <div className="mb-5 flex items-center justify-between gap-4">
                <h3 className="flex items-center gap-2 text-lg font-bold">
                  <Users size={18} className="text-emerald-300" />
                  Top Leads
                </h3>
                <span className="text-xs font-bold uppercase tracking-widest text-slate-500">
                  {metrics.assessedLeads}/{metrics.totalLeads} scored
                </span>
              </div>
              <div className="space-y-3">
                {dashboard.topLeads.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/10 py-10 text-center text-sm text-slate-500">
                    No scored leads yet.
                  </div>
                ) : dashboard.topLeads.map((lead) => (
                  <Link
                    key={lead.id}
                    href={`/leads/${lead.id}`}
                    className="block rounded-2xl border border-white/10 bg-black/20 p-4 transition hover:border-emerald-400/30 hover:bg-white/[0.06]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-bold text-white">{lead.company}</div>
                        <div className="mt-1 truncate text-sm text-slate-400">{lead.name}</div>
                      </div>
                      <span className={`shrink-0 rounded-full border px-3 py-1 text-xs font-bold ${scoreClass(lead.assessment?.leadScore)}`}>
                        {formatScore(lead.assessment?.leadScore)}
                      </span>
                    </div>
                    <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-400">
                      {lead.assessment?.recommendedNextAction || 'Open lead details to run discovery.'}
                    </p>
                  </Link>
                ))}
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 sm:p-6">
              <div className="mb-5 flex items-center justify-between gap-4">
                <h3 className="flex items-center gap-2 text-lg font-bold">
                  <Briefcase size={18} className="text-amber-300" />
                  At-Risk Deals
                </h3>
                <span className="text-xs font-bold uppercase tracking-widest text-slate-500">
                  {metrics.assessedDeals}/{metrics.totalDeals} scored
                </span>
              </div>
              <div className="space-y-3">
                {dashboard.atRiskDeals.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/10 py-10 text-center text-sm text-slate-500">
                    No scored deals yet.
                  </div>
                ) : dashboard.atRiskDeals.map((deal) => (
                  <Link
                    key={deal.id}
                    href={`/deals/${deal.id}`}
                    className="block rounded-2xl border border-white/10 bg-black/20 p-4 transition hover:border-amber-400/30 hover:bg-white/[0.06]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-bold text-white">{deal.name}</div>
                        <div className="mt-1 truncate text-sm text-slate-400">{deal.lead.company}</div>
                      </div>
                      <span className={`shrink-0 rounded-full border px-3 py-1 text-xs font-bold ${scoreClass(deal.assessment?.closeReadinessScore)}`}>
                        {formatScore(deal.assessment?.closeReadinessScore)}
                      </span>
                    </div>
                    <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-400">
                      {deal.assessment?.recommendedNextAction || 'Open deal details to run close-readiness scoring.'}
                    </p>
                  </Link>
                ))}
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 sm:p-6">
              <div className="mb-5 flex items-center justify-between gap-4">
                <h3 className="flex items-center gap-2 text-lg font-bold">
                  <Clock3 size={18} className="text-cyan-300" />
                  Stalled Deals
                </h3>
                <span className="text-xs font-bold uppercase tracking-widest text-slate-500">
                  {metrics.stalledDeals} flagged
                </span>
              </div>
              <div className="space-y-3">
                {dashboard.stalledDeals.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/10 py-10 text-center text-sm text-slate-500">
                    No stalled deals right now.
                  </div>
                ) : dashboard.stalledDeals.map((deal) => (
                  <Link
                    key={deal.id}
                    href={`/deals/${deal.id}`}
                    className="block rounded-2xl border border-white/10 bg-black/20 p-4 transition hover:border-cyan-400/30 hover:bg-white/[0.06]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-bold text-white">{deal.name}</div>
                        <div className="mt-1 truncate text-sm text-slate-400">{deal.lead.company}</div>
                      </div>
                      <span className={`shrink-0 rounded-full border px-3 py-1 text-xs font-bold uppercase ${momentumClass(deal.momentum.status)}`}>
                        {deal.momentum.status} {deal.momentum.score}
                      </span>
                    </div>
                    <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-400">
                      {deal.momentum.recommendedAction}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                      <span>{deal.momentum.daysSinceActivity === null ? 'No touch' : `${deal.momentum.daysSinceActivity}d since touch`}</span>
                      <span>{deal.momentum.overdueActivityCount} overdue</span>
                    </div>
                  </Link>
                ))}
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 sm:p-6">
              <div className="mb-5 flex items-center justify-between gap-4">
                <h3 className="flex items-center gap-2 text-lg font-bold">
                  <TrendingUp size={18} className="text-rose-300" />
                  Forecast Risk
                </h3>
                <span className="text-xs font-bold uppercase tracking-widest text-slate-500">
                  {metrics.forecastAtRiskDeals} flagged
                </span>
              </div>
              <div className="space-y-3">
                {dashboard.forecastRiskDeals.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/10 py-10 text-center text-sm text-slate-500">
                    No forecast risks right now.
                  </div>
                ) : dashboard.forecastRiskDeals.map((deal) => (
                  <Link
                    key={deal.id}
                    href={`/deals/${deal.id}`}
                    className="block rounded-2xl border border-white/10 bg-black/20 p-4 transition hover:border-rose-400/30 hover:bg-white/[0.06]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-bold text-white">{deal.name}</div>
                        <div className="mt-1 truncate text-sm text-slate-400">{deal.lead.company}</div>
                      </div>
                      <span className={`shrink-0 rounded-full border px-3 py-1 text-xs font-bold uppercase ${forecastClass(deal.forecast.status)}`}>
                        {deal.forecast.label}
                      </span>
                    </div>
                    <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-400">
                      {deal.forecast.recommendedAction}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                      <span>{deal.forecast.confidence}% confidence</span>
                      <span>{deal.forecast.trend}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          </div>

          <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 sm:p-6">
            <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="flex items-center gap-2 text-lg font-bold">
                <AlertTriangle size={18} className="text-rose-300" />
                Objection Patterns
              </h3>
              <span className="text-xs font-bold uppercase tracking-widest text-slate-500">
                {metrics.objectionPatternCount} patterns / {metrics.trackedObjections} signals
              </span>
            </div>

            {dashboard.objectionPatterns.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 py-10 text-center text-sm text-slate-500">
                No objection patterns captured yet.
              </div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-3">
                {dashboard.objectionPatterns.map((pattern) => (
                  <div key={pattern.key} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div>
                        <div className="font-bold text-white">{pattern.label}</div>
                        <div className="mt-1 text-xs text-slate-500">{pattern.count} mentions</div>
                      </div>
                      <span className={`shrink-0 rounded-full border px-3 py-1 text-xs font-bold uppercase ${severityClass(pattern.severity)}`}>
                        {pattern.severity}
                      </span>
                    </div>
                    <p className="text-sm leading-6 text-slate-300">{pattern.recommendedResponse}</p>

                    <div className="mt-4">
                      <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">Playbook</div>
                      <div className="space-y-2">
                        {pattern.playbook.slice(0, 3).map((step) => (
                          <div key={step} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-slate-300">
                            {step}
                          </div>
                        ))}
                      </div>
                    </div>

                    {pattern.examples.length > 0 && (
                      <div className="mt-4">
                        <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">Examples</div>
                        <p className="line-clamp-3 text-sm leading-6 text-slate-400">
                          {pattern.examples.join(' | ')}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 sm:p-6">
            <div className="mb-5 flex items-center justify-between gap-4">
              <h3 className="text-lg font-bold">Recent AI Assessments</h3>
              <span className="text-xs font-bold uppercase tracking-widest text-slate-500">
                Missing discovery: {metrics.leadsMissingDiscovery + metrics.dealsMissingDiscovery}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="responsive-table w-full text-left">
                <thead>
                  <tr className="text-sm uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-3 font-semibold">Record</th>
                    <th className="px-4 py-3 font-semibold">Type</th>
                    <th className="px-4 py-3 font-semibold">Score</th>
                    <th className="px-4 py-3 font-semibold">Next Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {dashboard.recentAssessments.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-10 text-center text-slate-500">No assessments generated yet.</td>
                    </tr>
                  ) : dashboard.recentAssessments.map((assessment) => {
                    const href = assessment.deal ? `/deals/${assessment.deal.id}` : assessment.lead ? `/leads/${assessment.lead.id}` : '/sales-accelerator';
                    const title = assessment.deal?.name || assessment.lead?.company || 'Assessment';
                    return (
                      <tr key={assessment.id} className="transition hover:bg-white/5">
                        <td className="px-4 py-4" data-label="Record">
                          <Link href={href} className="font-semibold text-white transition hover:text-indigo-300">
                            {title}
                          </Link>
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-400" data-label="Type">{assessment.assessmentType}</td>
                        <td className="px-4 py-4" data-label="Score">
                          <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${scoreClass(assessment.leadScore ?? assessment.closeReadinessScore)}`}>
                            {formatScore(assessment.leadScore ?? assessment.closeReadinessScore)}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-400" data-label="Next Action">
                          {assessment.recommendedNextAction || assessment.summary || 'No action captured.'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </DashboardLayout>
  );
}
