'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';
import api from '@/lib/api';
import { Plus, Search, DollarSign, Target, Briefcase } from 'lucide-react';

interface Deal {
  id: string;
  name: string;
  stage: string;
  lead: { name: string; company: string };
  createdAt: string;
  clientId: string | null;
  client?: { name: string; companyName: string };
  salesAssessments?: Array<{
    leadScore: number | null;
    priorityTier: string | null;
    closeReadinessScore: number | null;
    discoveryQualityScore: number | null;
    recommendedNextAction: string | null;
    createdAt: string;
  }>;
}

interface LeadOption {
  id: string;
  name: string;
  company: string;
}

interface ClientOption {
  id: string;
  name: string;
  companyName: string | null;
}

const scoreClass = (score?: number | null) => {
  if ((score || 0) >= 75) return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300';
  if ((score || 0) >= 50) return 'border-amber-500/20 bg-amber-500/10 text-amber-300';
  if (typeof score === 'number') return 'border-rose-500/20 bg-rose-500/10 text-rose-300';
  return 'border-white/10 bg-white/5 text-slate-500';
};

export default function DealsPage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [leads, setLeads] = useState<LeadOption[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [newDeal, setNewDeal] = useState({ name: '', leadId: '', clientId: '' });
  const [searchQuery, setSearchQuery] = useState('');

  const getClientLabel = (client: ClientOption) => {
    const companyName = client.companyName;

    if (!companyName || companyName === client.name) {
      return client.name;
    }

    return `${companyName} (${client.name})`;
  };

  const fetchData = async () => {
    const [dealsResult, leadsResult, clientsResult] = await Promise.allSettled([
      api.get('deals'),
      api.get('leads'),
      api.get('clients'),
    ]);

    if (dealsResult.status === 'fulfilled') {
      setDeals(dealsResult.value.data);
    } else {
      console.error('Failed to fetch deals', dealsResult.reason);
    }

    if (leadsResult.status === 'fulfilled') {
      setLeads(leadsResult.value.data);
    } else {
      console.error('Failed to fetch leads', leadsResult.reason);
    }

    if (clientsResult.status === 'fulfilled') {
      setClients(clientsResult.value.data);
    } else {
      console.error('Failed to fetch clients', clientsResult.reason);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddDeal = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...newDeal,
        clientId: newDeal.clientId || null
      };
      await api.post('deals', payload);
      setShowModal(false);
      setNewDeal({ name: '', leadId: '', clientId: '' });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h2 className="text-2xl font-bold sm:text-3xl">Sales Pipeline</h2>
          <p className="text-muted-foreground">Track your active deals and conversion progress.</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-3 font-bold text-white shadow-lg transition-all hover:bg-indigo-500 sm:w-auto"
        >
          <Plus size={20} />
          <span>New Deal</span>
        </button>
      </div>

      <div className="glass-card rounded-3xl overflow-hidden">
        <div className="border-b border-white/5 bg-white/5 p-4 sm:p-6">
          <div className="relative w-full sm:max-w-sm">
            <Search className="absolute left-3 top-2.5 text-muted-foreground" size={18} />
            <input 
              type="text" 
              placeholder="Filter deals..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-10 pr-4 focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 p-4 sm:p-6 md:grid-cols-2 lg:grid-cols-3 lg:gap-6">
          {loading ? (
            <div className="col-span-full py-20 text-center text-muted-foreground italic">Syncing with pipeline...</div>
          ) : deals.length === 0 ? (
            <div className="col-span-full py-20 text-center text-muted-foreground">No active deals. Start by converting a lead!</div>
          ) : deals.filter(deal => {
              if (!searchQuery) return true;
              const query = searchQuery.toLowerCase();
              return deal.name.toLowerCase().includes(query);
            }).length === 0 ? (
              <div className="col-span-full py-20 text-center text-muted-foreground">No active deals match your search.</div>
          ) : deals.filter(deal => {
              if (!searchQuery) return true;
              const query = searchQuery.toLowerCase();
              return deal.name.toLowerCase().includes(query);
            }).map((deal) => (
            <div key={deal.id} className="glass-card p-6 rounded-2xl border-white/5 hover:border-indigo-500/50 transition-all group">
              {(() => {
                const assessment = deal.salesAssessments?.[0];
                return (
                  <>
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
                  <Briefcase size={20} />
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-400 bg-indigo-400/10 px-2 py-1 rounded-md">
                    {deal.stage}
                  </span>
                  <span className={`rounded-md border px-2 py-1 text-xs font-bold uppercase tracking-wider ${scoreClass(assessment?.closeReadinessScore)}`}>
                    {assessment?.closeReadinessScore ?? '--'} ready
                  </span>
                </div>
              </div>
              <Link href={`/deals/${deal.id}`} className="block text-xl font-bold mb-1 truncate transition hover:text-indigo-300">
                {deal.name}
              </Link>
              <p className="text-sm text-muted-foreground mb-4 flex items-center gap-1">
                <Target size={14} />
                {deal.lead.company}
              </p>
              {deal.client && (
                <p className="text-xs text-emerald-400 font-medium mb-4">
                  Client: {deal.client.name}
                </p>
              )}
              <div className="min-h-10 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs leading-5 text-slate-400">
                {assessment?.recommendedNextAction || 'Run Sales Accelerator scoring from deal details.'}
              </div>
              
              <div className="flex items-center justify-between pt-4 border-t border-white/5 mt-4">
                <div className="flex items-center gap-1 text-emerald-400 font-bold">
                  <DollarSign size={16} />
                  <span>Proposed</span>
                </div>
                <Link href={`/deals/${deal.id}`} className="text-xs font-bold text-muted-foreground hover:text-white transition-colors">
                  VIEW DETAILS
                </Link>
              </div>
                  </>
                );
              })()}
            </div>
          ))}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="glass-card max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-3xl border-white/10 p-5 shadow-3xl sm:p-8">
            <h3 className="text-2xl font-bold mb-6">Start a New Deal</h3>
            <form onSubmit={handleAddDeal} className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-muted-foreground">Deal Title</label>
                <input 
                  type="text" 
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="Security Contract Q3"
                  value={newDeal.name}
                  onChange={(e) => setNewDeal({...newDeal, name: e.target.value})}
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-muted-foreground">Select Lead</label>
                <select 
                  className="w-full bg-[#1e293b] border border-white/10 rounded-xl py-2.5 px-4 focus:outline-none focus:ring-2 focus:ring-primary/50 text-white"
                  value={newDeal.leadId}
                  onChange={(e) => setNewDeal({...newDeal, leadId: e.target.value})}
                  required
                >
                  <option value="">Choose a lead...</option>
                  {leads.length === 0 && <option value="" disabled>No leads available</option>}
                  {leads.map(lead => (
                    <option key={lead.id} value={lead.id}>{lead.company} ({lead.name})</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-muted-foreground">Link to Client (Optional)</label>
                <select 
                  className="w-full bg-[#1e293b] border border-white/10 rounded-xl py-2.5 px-4 focus:outline-none focus:ring-2 focus:ring-primary/50 text-white"
                  value={newDeal.clientId}
                  onChange={(e) => setNewDeal({...newDeal, clientId: e.target.value})}
                >
                  <option value="">Choose a client...</option>
                  {clients.length === 0 && <option value="" disabled>No clients available</option>}
                  {clients.map(client => (
                    <option key={client.id} value={client.id}>{getClientLabel(client)}</option>
                  ))}
                </select>
              </div>
              <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:gap-4">
                <button 
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 bg-white/5 hover:bg-white/10 text-white font-bold py-3 rounded-2xl transition-all border border-white/10"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 bg-primary hover:bg-indigo-500 text-white font-bold py-3 rounded-2xl transition-all shadow-lg"
                >
                  Initialize Deal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
