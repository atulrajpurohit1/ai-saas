'use client';

import React, { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import api from '@/lib/api';
import { Plus, Search, DollarSign, Target, Briefcase } from 'lucide-react';

interface Deal {
  id: string;
  name: string;
  stage: string;
  lead: { name: string; company: string };
  createdAt: string;
}

export default function DealsPage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [leads, setLeads] = useState<any[]>([]);
  const [newDeal, setNewDeal] = useState({ name: '', leadId: '' });

  const fetchData = async () => {
    try {
      const [dealsRes, leadsRes] = await Promise.all([
        api.get('deals'),
        api.get('leads')
      ]);
      setDeals(dealsRes.data);
      setLeads(leadsRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddDeal = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('deals', newDeal);
      setShowModal(false);
      setNewDeal({ name: '', leadId: '' });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h2 className="text-3xl font-bold">Sales Pipeline</h2>
          <p className="text-muted-foreground">Track your active deals and conversion progress.</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="bg-primary hover:bg-indigo-500 text-white font-bold py-3 px-6 rounded-2xl transition-all shadow-lg flex items-center justify-center gap-2"
        >
          <Plus size={20} />
          <span>New Deal</span>
        </button>
      </div>

      <div className="glass-card rounded-3xl overflow-hidden">
        <div className="p-6 border-b border-white/5 bg-white/5 flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-2.5 text-muted-foreground" size={18} />
            <input 
              type="text" 
              placeholder="Filter deals..." 
              className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-10 pr-4 focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? (
            <div className="col-span-full py-20 text-center text-muted-foreground italic">Syncing with pipeline...</div>
          ) : deals.length === 0 ? (
            <div className="col-span-full py-20 text-center text-muted-foreground">No active deals. Start by converting a lead!</div>
          ) : deals.map((deal) => (
            <div key={deal.id} className="glass-card p-6 rounded-2xl border-white/5 hover:border-indigo-500/50 transition-all group">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
                  <Briefcase size={20} />
                </div>
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-400 bg-indigo-400/10 px-2 py-1 rounded-md">
                  {deal.stage}
                </span>
              </div>
              <h4 className="text-xl font-bold mb-1 truncate">{deal.name}</h4>
              <p className="text-sm text-muted-foreground mb-4 flex items-center gap-1">
                <Target size={14} />
                {deal.lead.company}
              </p>
              
              <div className="flex items-center justify-between pt-4 border-t border-white/5 mt-4">
                <div className="flex items-center gap-1 text-emerald-400 font-bold">
                  <DollarSign size={16} />
                  <span>Proposed</span>
                </div>
                <button className="text-xs font-bold text-muted-foreground hover:text-white transition-colors">
                  EDIT DETAILS
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="glass-card w-full max-w-md rounded-3xl p-8 border-white/10 shadow-3xl">
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
                  {leads.map(lead => (
                    <option key={lead.id} value={lead.id}>{lead.company} ({lead.name})</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-4 mt-8">
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
