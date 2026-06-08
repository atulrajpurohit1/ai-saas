'use client';

import React, { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import { 
  Users, 
  Briefcase, 
  FileText, 
  TrendingUp, 
  Clock
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
  const [stats, setStats] = useState({
    leads: 0,
    deals: 0,
    proposals: 0,
  });
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [leadsRes, dealsRes, proposalsRes] = await Promise.allSettled([
          api.get('leads'),
          api.get('deals'),
          api.get('proposals'),
        ]);

        const leads = leadsRes.status === 'fulfilled' && Array.isArray(leadsRes.value.data) ? leadsRes.value.data : [];
        const deals = dealsRes.status === 'fulfilled' && Array.isArray(dealsRes.value.data) ? dealsRes.value.data : [];
        const proposals = proposalsRes.status === 'fulfilled' && Array.isArray(proposalsRes.value.data) ? proposalsRes.value.data : [];

        setStats({
          leads: leads.length,
          deals: deals.length,
          proposals: proposals.length,
        });
        setActivities(buildRecentActivities(leads, deals, proposals));
        setError(
          [leadsRes, dealsRes, proposalsRes].some((result) => result.status === 'rejected')
            ? 'Some dashboard stats could not be loaded. Check that the backend API is running.'
            : '',
        );
      } catch (err) {
        console.error('Failed to fetch stats', err);
        setError('Dashboard stats could not be loaded. Check that the backend API is running.');
      }
    };
    fetchStats();
  }, []);

  const statCards = [
    { label: 'Total Leads', value: stats.leads, icon: Users, color: 'indigo' },
    { label: 'Active Deals', value: stats.deals, icon: Briefcase, color: 'purple' },
    { label: 'Proposals Sent', value: stats.proposals, icon: FileText, color: 'blue' },
  ];

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

      <div className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="glass-card group cursor-default rounded-3xl p-5 transition-all hover:border-primary/50 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-2xl bg-${stat.color}-500/10 text-${stat.color}-400 group-hover:scale-110 transition-transform`}>
                  <Icon size={24} />
                </div>
                <div className="flex items-center gap-1 text-emerald-400 text-sm font-bold bg-emerald-500/10 px-2 py-1 rounded-lg">
                  <TrendingUp size={14} />
                  <span>+12%</span>
                </div>
              </div>
              <p className="text-muted-foreground font-medium mb-1">{stat.label}</p>
              <h3 className="text-3xl font-bold sm:text-4xl">{stat.value}</h3>
            </div>
          );
        })}
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
