'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import { DashboardSummary, getDashboardSummary } from '@/lib/dashboard';
import { DEAL_STAGE_COLORS } from '@/lib/deals';
import { formatEnumLabel } from '@/lib/format';
import TrendAreaChart from '@/components/charts/TrendAreaChart';
import CategoryBarChart from '@/components/charts/CategoryBarChart';
import StatDelta from '@/components/charts/StatDelta';
import {
  Users,
  Briefcase,
  FileText,
  Clock,
  TrendingUp,
  GitBranch,
  Loader2,
  UserPlus,
  Radar,
  FilePlus2,
  Upload,
  PhoneCall,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';

interface DashboardEntity {
  id: string;
  name?: string | null;
  company?: string | null;
  title?: string | null;
  createdAt?: string | null;
  lead?: {
    name?: string | null;
    company?: string | null;
  } | null;
}

interface ActivityItem {
  id: string;
  kind: 'lead' | 'deal' | 'proposal';
  title: string;
  subject: string;
  timestamp: number;
}

const getTimestamp = (value?: string | null) => {
  if (!value) return 0;
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
};

const formatRelativeTime = (timestamp: number) => {
  if (!timestamp) return 'recently';

  const elapsedMs = Date.now() - timestamp;
  if (elapsedMs < 60_000) return 'just now';

  const minutes = Math.floor(elapsedMs / 60_000);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;

  return new Date(timestamp).toLocaleDateString();
};

const formatWeekLabel = (isoDate: string) => {
  const date = new Date(`${isoDate}T00:00:00Z`);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
};

const buildRecentActivities = (
  leads: DashboardEntity[],
  deals: DashboardEntity[],
  proposals: DashboardEntity[],
) => {
  const activities: ActivityItem[] = [
    ...leads.map((lead) => ({
      id: `lead-${lead.id}`,
      kind: 'lead' as const,
      title: 'New Lead Created',
      subject: lead.company || lead.name || 'Lead',
      timestamp: getTimestamp(lead.createdAt),
    })),
    ...deals.map((deal) => ({
      id: `deal-${deal.id}`,
      kind: 'deal' as const,
      title: 'Deal Started',
      subject: deal.name || deal.lead?.company || 'Deal',
      timestamp: getTimestamp(deal.createdAt),
    })),
    ...proposals.map((proposal) => ({
      id: `proposal-${proposal.id}`,
      kind: 'proposal' as const,
      title: 'Proposal Created',
      subject: proposal.title || proposal.lead?.company || 'Proposal',
      timestamp: getTimestamp(proposal.createdAt),
    })),
  ];

  return activities
    .filter((activity) => activity.timestamp > 0)
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 5);
};

const ACTIVITY_ICON: Record<ActivityItem['kind'], React.ComponentType<{ size?: number; className?: string }>> = {
  lead: UserPlus,
  deal: Briefcase,
  proposal: FileText,
};

const QUICK_ACTIONS = [
  { href: '/leads', label: 'Add Lead', icon: UserPlus },
  { href: '/prospect-search', label: 'Find Prospects', icon: Radar },
  { href: '/proposals', label: 'Create Proposal', icon: FilePlus2 },
  { href: '/integrations', label: 'Import Leads', icon: Upload },
  { href: '/sales-calls', label: 'Schedule Call', icon: PhoneCall },
];

// Real-data insight copy, derived entirely from the same deltaPct/count
// figures the KPI cards already show - not an AI-generated sentence, so
// this is labeled "Insights" rather than "AI Insights". Only speaks up when
// there's an honest, real signal worth surfacing (a real move up/down, or a
// real 0-lead week) - stays silent rather than inventing filler otherwise.
function buildInsights(summary: DashboardSummary | null) {
  if (!summary) return [];
  const insights: { icon: 'up' | 'down'; text: string }[] = [];

  if (summary.leads.deltaPct !== null && Math.abs(summary.leads.deltaPct) >= 1) {
    const up = summary.leads.deltaPct > 0;
    insights.push({
      icon: up ? 'up' : 'down',
      text: `Leads are trending ${up ? 'up' : 'down'} ${Math.abs(summary.leads.deltaPct)}% vs. the prior 7 days.`,
    });
  }
  if (summary.deals.deltaPct !== null && Math.abs(summary.deals.deltaPct) >= 1) {
    const up = summary.deals.deltaPct > 0;
    insights.push({
      icon: up ? 'up' : 'down',
      text: `Active deals are ${up ? 'up' : 'down'} ${Math.abs(summary.deals.deltaPct)}% week over week.`,
    });
  }
  if (summary.proposals.deltaPct !== null && Math.abs(summary.proposals.deltaPct) >= 1) {
    const up = summary.proposals.deltaPct > 0;
    insights.push({
      icon: up ? 'up' : 'down',
      text: `Proposal activity is ${up ? 'up' : 'down'} ${Math.abs(summary.proposals.deltaPct)}% vs. last week.`,
    });
  }
  return insights.slice(0, 2);
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [trendRange, setTrendRange] = useState<4 | 8>(8);

  useEffect(() => {
    const fetchDashboard = async () => {
      setLoading(true);
      try {
        const [summaryRes, leadsRes, dealsRes, proposalsRes] = await Promise.allSettled([
          getDashboardSummary(),
          api.get('leads'),
          api.get('deals'),
          api.get('proposals'),
        ]);

        if (summaryRes.status === 'fulfilled') {
          setSummary(summaryRes.value);
        }

        const leads = leadsRes.status === 'fulfilled' && Array.isArray(leadsRes.value.data) ? leadsRes.value.data : [];
        const deals = dealsRes.status === 'fulfilled' && Array.isArray(dealsRes.value.data) ? dealsRes.value.data : [];
        const proposals = proposalsRes.status === 'fulfilled' && Array.isArray(proposalsRes.value.data) ? proposalsRes.value.data : [];
        setActivities(buildRecentActivities(leads, deals, proposals));

        if (summaryRes.status === 'rejected') {
          setError('Dashboard analytics could not be loaded. Check that the backend API is running.');
        } else {
          setError('');
        }
      } catch (err) {
        console.error('Failed to fetch dashboard', err);
        setError('Dashboard stats could not be loaded. Check that the backend API is running.');
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, []);

  const statCards = summary
    ? [
        {
          label: 'Total Leads',
          value: summary.leads.total,
          icon: Users,
          deltaPct: summary.leads.deltaPct,
          hasActivity: summary.leads.last7Days > 0,
        },
        {
          label: 'Active Deals',
          value: summary.deals.active,
          icon: Briefcase,
          deltaPct: summary.deals.deltaPct,
          hasActivity: summary.deals.last7Days > 0,
        },
        {
          label: 'Proposals Sent',
          value: summary.proposals.sent,
          icon: FileText,
          deltaPct: summary.proposals.deltaPct,
          hasActivity: summary.proposals.last7Days > 0,
        },
      ]
    : [];

  const dealStageData = (summary?.deals.byStage || [])
    .slice()
    .sort((a, b) => b.count - a.count)
    .map((s) => ({
      key: s.stage,
      label: formatEnumLabel(s.stage),
      value: s.count,
      color: DEAL_STAGE_COLORS[s.stage] || '#4f46e5',
    }));

  const weeklyTrend = useMemo(() => summary?.leads.weeklyTrend || [], [summary]);
  const trendPoints = useMemo(
    () =>
      weeklyTrend
        .slice(trendRange === 4 ? -4 : 0)
        .map((w) => ({ label: formatWeekLabel(w.weekStart), value: w.count })),
    [weeklyTrend, trendRange],
  );

  const insights = useMemo(() => buildInsights(summary), [summary]);

  return (
    <DashboardLayout>
      <div className="mb-5 lg:hidden">
        <h2 className="text-xl font-semibold text-foreground">
          Welcome back, {user?.name?.split(' ')[0] || 'there'}
        </h2>
        <p className="text-sm text-muted-foreground">Here&apos;s what&apos;s happening in your pipeline today.</p>
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-error/20 bg-error-wash px-5 py-4 text-sm font-medium text-error">
          {error}
        </div>
      )}

      {/* KPI cards */}
      {loading ? (
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse rounded-2xl border border-border bg-card p-5">
              <div className="mb-3 h-9 w-9 rounded-lg bg-muted" />
              <div className="mb-2 h-3 w-20 rounded bg-muted" />
              <div className="h-7 w-14 rounded bg-muted" />
            </div>
          ))}
        </div>
      ) : (
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {statCards.map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="rounded-2xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/8 text-primary">
                    <Icon size={18} />
                  </div>
                  <StatDelta deltaPct={stat.deltaPct} hasActivity={stat.hasActivity} />
                </div>
                <p className="text-xs font-medium text-muted-foreground">{stat.label}</p>
                <h3 className="mt-0.5 text-3xl font-semibold tracking-tight text-foreground">{stat.value}</h3>
                <p className="mt-1 text-[11px] text-muted-foreground">vs. previous 7 days</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Insights strip - real deltaPct-derived copy only, never shown empty-handed */}
      {!loading && insights.length > 0 && (
        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {insights.map((insight, i) => (
            <div key={i} className="flex items-start gap-3 rounded-2xl border border-primary/15 bg-primary/[0.04] p-4">
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                {insight.icon === 'up' ? <ArrowUpRight size={15} /> : <ArrowDownRight size={15} />}
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-primary">Insight</p>
                <p className="text-sm text-foreground">{insight.text}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Quick actions */}
      <div className="mb-6 flex flex-wrap gap-2">
        {QUICK_ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.href}
              href={action.href}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3.5 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:border-primary/30 hover:text-primary"
            >
              <Icon size={15} className="text-muted-foreground" />
              {action.label}
            </Link>
          );
        })}
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-5">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm xl:col-span-3">
          <div className="mb-4 flex items-center gap-2">
            <TrendingUp className="text-primary" size={17} />
            <h3 className="text-base font-semibold text-foreground">Lead Trend</h3>
            {weeklyTrend.length > 4 && (
              <div className="ml-auto flex items-center gap-1 rounded-lg bg-muted p-0.5">
                {([4, 8] as const).map((range) => (
                  <button
                    key={range}
                    type="button"
                    onClick={() => setTrendRange(range)}
                    className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                      trendRange === range ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {range}W
                  </button>
                ))}
              </div>
            )}
          </div>
          {loading ? (
            <div className="flex h-[220px] items-center justify-center text-muted-foreground">
              <Loader2 className="animate-spin" size={20} />
            </div>
          ) : (
            <TrendAreaChart
              points={trendPoints}
              emptyMessage="No leads created in this period."
              seriesColor="#4f46e5"
            />
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm xl:col-span-2">
          <div className="mb-4 flex items-center gap-2">
            <GitBranch className="text-primary" size={17} />
            <h3 className="text-base font-semibold text-foreground">Deals by Stage</h3>
          </div>
          {loading ? (
            <div className="flex h-32 items-center justify-center text-muted-foreground">
              <Loader2 className="animate-spin" size={20} />
            </div>
          ) : (
            <CategoryBarChart data={dealStageData} emptyMessage="No deals in the pipeline yet." />
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-base font-semibold text-foreground">
            <Clock className="text-primary" size={17} />
            Recent Activity
          </h3>
        </div>
        <div className="space-y-1">
          {activities.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground">
              No recent activity yet.
            </div>
          ) : (
            activities.map((activity) => {
              const Icon = ACTIVITY_ICON[activity.kind];
              return (
                <div key={activity.id} className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-muted">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/8 text-primary">
                    <Icon size={15} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{activity.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{activity.subject}</p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">{formatRelativeTime(activity.timestamp)}</span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
