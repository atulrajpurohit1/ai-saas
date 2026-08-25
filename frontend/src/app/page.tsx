'use client';

import React, { useEffect, useState } from 'react';
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
      title: 'New Lead Created',
      subject: lead.company || lead.name || 'Lead',
      timestamp: getTimestamp(lead.createdAt),
    })),
    ...deals.map((deal) => ({
      id: `deal-${deal.id}`,
      title: 'Deal Started',
      subject: deal.name || deal.lead?.company || 'Deal',
      timestamp: getTimestamp(deal.createdAt),
    })),
    ...proposals.map((proposal) => ({
      id: `proposal-${proposal.id}`,
      title: 'Proposal Created',
      subject: proposal.title || proposal.lead?.company || 'Proposal',
      timestamp: getTimestamp(proposal.createdAt),
    })),
  ];

  return activities
    .filter((activity) => activity.timestamp > 0)
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 3);
};

export default function DashboardPage() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
          color: 'indigo',
          deltaPct: summary.leads.deltaPct,
          hasActivity: summary.leads.last7Days > 0,
        },
        {
          label: 'Active Deals',
          value: summary.deals.active,
          icon: Briefcase,
          color: 'purple',
          deltaPct: summary.deals.deltaPct,
          hasActivity: summary.deals.last7Days > 0,
        },
        {
          label: 'Proposals Sent',
          value: summary.proposals.sent,
          icon: FileText,
          color: 'blue',
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
      color: DEAL_STAGE_COLORS[s.stage] || '#818cf8',
    }));

  return (
    <DashboardLayout>
      <div className="mb-8">
        <h2 className="mb-2 text-2xl font-bold sm:text-3xl">Welcome back, <span className="gradient-text">{user?.name}</span></h2>
        <p className="text-muted-foreground">Here&apos;s what&apos;s happening in your company today.</p>
      </div>

      {error && (
        <div className="mb-6 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-5 py-4 text-sm font-medium text-rose-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="glass-card animate-pulse rounded-3xl p-5 sm:p-6">
              <div className="mb-4 h-10 w-10 rounded-2xl bg-white/5" />
              <div className="mb-2 h-4 w-24 rounded bg-white/5" />
              <div className="h-8 w-16 rounded bg-white/5" />
            </div>
          ))}
        </div>
      ) : (
        <div className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
          {statCards.map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="glass-card group cursor-default rounded-3xl p-5 transition-all hover:border-primary/50 sm:p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className={`p-3 rounded-2xl bg-${stat.color}-500/10 text-${stat.color}-400 group-hover:scale-110 transition-transform`}>
                    <Icon size={24} />
                  </div>
                  <StatDelta deltaPct={stat.deltaPct} hasActivity={stat.hasActivity} />
                </div>
                <p className="text-muted-foreground font-medium mb-1">{stat.label}</p>
                <h3 className="text-3xl font-bold sm:text-4xl">{stat.value}</h3>
                <p className="mt-1 text-xs text-muted-foreground">vs. previous 7 days</p>
              </div>
            );
          })}
        </div>
      )}

      <div className="mb-8 grid grid-cols-1 gap-6 xl:grid-cols-5">
        <div className="glass-card rounded-3xl p-5 sm:p-6 xl:col-span-3">
          <div className="mb-6 flex items-center gap-2">
            <TrendingUp className="text-indigo-400" size={20} />
            <h3 className="text-xl font-bold">Lead Trend</h3>
            <span className="ml-auto text-xs font-bold uppercase tracking-widest text-muted-foreground">Last 8 weeks</span>
          </div>
          {loading ? (
            <div className="flex h-[200px] items-center justify-center text-muted-foreground">
              <Loader2 className="animate-spin" size={20} />
            </div>
          ) : (
            <TrendAreaChart
              points={(summary?.leads.weeklyTrend || []).map((w) => ({ label: formatWeekLabel(w.weekStart), value: w.count }))}
              emptyMessage="No leads created in the last 8 weeks."
              seriesColor="#818cf8"
            />
          )}
        </div>

        <div className="glass-card rounded-3xl p-5 sm:p-6 xl:col-span-2">
          <div className="mb-6 flex items-center gap-2">
            <GitBranch className="text-indigo-400" size={20} />
            <h3 className="text-xl font-bold">Deals by Stage</h3>
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

      <div className="glass-card rounded-3xl p-5 sm:p-6">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-xl font-bold flex items-center gap-2">
              <Clock className="text-indigo-400" size={20} />
              Recent Activity
            </h3>
            <span className="rounded-full border border-indigo-400/20 bg-indigo-400/10 px-3 py-1 text-xs font-bold text-indigo-300">
              Latest 3
            </span>
          </div>
          <div className="space-y-4">
            {activities.length === 0 ? (
              <div className="rounded-2xl border border-white/5 bg-white/5 p-5 text-sm text-muted-foreground">
                No recent activity yet.
              </div>
            ) : (
              activities.map((activity, index) => (
              <div key={activity.id} className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors border border-transparent hover:border-white/5">
                <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold">
                  {index + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{activity.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {activity.subject} - {formatRelativeTime(activity.timestamp)}
                  </p>
                </div>
              </div>
            )))}
          </div>
      </div>
    </DashboardLayout>
  );
}
