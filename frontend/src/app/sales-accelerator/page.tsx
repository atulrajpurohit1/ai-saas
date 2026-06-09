'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';
import api from '@/lib/api';
import {
  AlertTriangle,
  BrainCircuit,
  Briefcase,
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

interface DashboardDeal {
  id: string;
  name: string;
  stage: string;
  lead: { id: string; name: string; company: string };
  client: { id: string; name: string; companyName: string | null } | null;
  assessment: Assessment | null;
}

interface RecentAssessment extends Assessment {
  assessmentType: string;
  lead: { id: string; name: string; company: string } | null;
  deal: { id: string; name: string; stage: string } | null;
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
    leadsMissingDiscovery: number;
    dealsMissingDiscovery: number;
    averageLeadScore: number | null;
    averageCloseReadiness: number | null;
  };
  topLeads: DashboardLead[];
  atRiskDeals: DashboardDeal[];
  recentAssessments: RecentAssessment[];
}

const scoreClass = (score?: number | null) => {
  if ((score || 0) >= 75) return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300';
  if ((score || 0) >= 50) return 'border-amber-500/20 bg-amber-500/10 text-amber-300';
  if (typeof score === 'number') return 'border-rose-500/20 bg-rose-500/10 text-rose-300';
  return 'border-white/10 bg-white/5 text-slate-500';
};

const formatScore = (score?: number | null) => typeof score === 'number' ? score : '--';

export default function SalesAcceleratorDashboardPage() {
  const [dashboard, setDashboard] = useState<SalesDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

          <div className="grid gap-6 xl:grid-cols-2">
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
          </div>

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
