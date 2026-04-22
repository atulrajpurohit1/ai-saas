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
  Clock,
  ArrowUpRight
} from 'lucide-react';

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    leads: 0,
    deals: 0,
    proposals: 0,
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [leadsRes, dealsRes, proposalsRes] = await Promise.all([
          api.get('leads'),
          api.get('deals'),
          api.get('proposals'),
        ]);
        setStats({
          leads: leadsRes.data.length,
          deals: dealsRes.data.length,
          proposals: proposalsRes.data.length,
        });
      } catch (err) {
        console.error('Failed to fetch stats', err);
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
        <h2 className="text-3xl font-bold mb-2">Welcome back, <span className="gradient-text">{user?.name}</span></h2>
        <p className="text-muted-foreground">Here's what's happening in your company today.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="glass-card p-6 rounded-3xl group hover:border-primary/50 transition-all cursor-default">
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
              <h3 className="text-4xl font-bold">{stat.value}</h3>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="glass-card rounded-3xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold flex items-center gap-2">
              <Clock className="text-indigo-400" size={20} />
              Recent Activity
            </h3>
            <button className="text-sm text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
              View All <ArrowUpRight size={16} />
            </button>
          </div>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors border border-transparent hover:border-white/5">
                <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold">
                  {i}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm">New Lead Created</p>
                  <p className="text-xs text-muted-foreground">ABC Security • 2 hours ago</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card rounded-3xl p-6 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 flex flex-col justify-between">
          <div>
            <h3 className="text-xl font-bold mb-4">AI Service Insight</h3>
            <p className="text-muted-foreground leading-relaxed">
              Based on your recent activity, we recommend generating a proposal for your <strong>3 new leads</strong> in the pipeline. Use our AI Assistant to get a draft ready in seconds.
            </p>
          </div>
          <button className="mt-8 bg-white/10 hover:bg-white/20 text-white font-bold py-3 rounded-2xl transition-all border border-white/10">
            Generate New Proposal
          </button>
        </div>
      </div>
    </DashboardLayout>
  );
}
