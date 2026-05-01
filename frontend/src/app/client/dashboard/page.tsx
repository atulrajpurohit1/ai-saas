'use client';

import React, { useEffect, useState } from 'react';
import ClientLayout from '@/components/ClientLayout';
import Link from 'next/link';
import axios from 'axios';
import { FileText, Clock, CheckCircle, XCircle, ArrowRight, Sparkles, Building } from 'lucide-react';

interface Proposal {
  id: string;
  title: string;
  status: string;
  createdAt: string;
}

export default function ClientDashboard() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProposals = async () => {
      try {
        const token = localStorage.getItem('client_token');
        const res = await axios.get('http://localhost:5000/api/client-portal/proposals', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setProposals(res.data);
      } catch (err) {
        console.error('Failed to fetch proposals', err);
      } finally {
        setLoading(false);
      }
    };
    fetchProposals();
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved': return <CheckCircle className="text-emerald-400" size={20} />;
      case 'rejected': return <XCircle className="text-rose-400" size={20} />;
      default: return <Clock className="text-yellow-400" size={20} />;
    }
  };

  return (
    <ClientLayout>
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-2">
          <Sparkles className="text-indigo-400" size={20} />
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-400">Client Workspace</span>
        </div>
        <h1 className="text-4xl font-extrabold text-white tracking-tight">Your Proposals</h1>
        <p className="text-slate-400 mt-2 text-lg">Review and manage your security service proposals.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full py-20 text-center text-slate-500 italic">Syncing with portal...</div>
        ) : proposals.length === 0 ? (
          <div className="col-span-full py-20 text-center glass-card rounded-[2rem] border-dashed border-white/5">
            <p className="text-slate-400">No proposals available at the moment.</p>
          </div>
        ) : proposals.map((p) => (
          <Link key={p.id} href={`/client/proposals/${p.id}`} className="group">
            <div className="glass-card bg-[#0a0a14]/60 hover:bg-[#0a0a14]/80 border border-white/5 hover:border-indigo-500/30 rounded-[2rem] p-8 transition-all duration-300 h-full flex flex-col group-hover:-translate-y-1">
              <div className="flex items-center justify-between mb-6">
                <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform">
                  <FileText size={24} />
                </div>
                <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                  p.status === 'approved' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                  p.status === 'rejected' ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' :
                  'bg-yellow-500/10 border-yellow-500/20 text-yellow-400'
                }`}>
                  {p.status}
                </div>
              </div>

              <h3 className="text-xl font-bold text-white mb-2 leading-tight">{p.title}</h3>
              <p className="text-slate-500 text-sm mb-8">
                Created on {new Date(p.createdAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
              </p>

              <div className="mt-auto flex items-center justify-between pt-6 border-t border-white/5">
                <div className="flex items-center gap-2">
                  {getStatusIcon(p.status)}
                  <span className="text-xs font-semibold text-slate-300 capitalize">{p.status}</span>
                </div>
                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-slate-400 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                  <ArrowRight size={16} />
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </ClientLayout>
  );
}
