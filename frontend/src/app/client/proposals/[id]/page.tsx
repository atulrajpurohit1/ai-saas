'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import ClientLayout from '@/components/ClientLayout';
import axios from 'axios';
import { 
  FileText, 
  CheckCircle, 
  XCircle, 
  ArrowLeft, 
  Download, 
  Calendar,
  AlertTriangle,
  Loader2,
  ShieldCheck
} from 'lucide-react';

interface Proposal {
  id: string;
  title: string;
  content: string;
  status: string;
  createdAt: string;
}

export default function ClientProposalView() {
  const { id } = useParams();
  const router = useRouter();
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchProposal = async () => {
    try {
      const token = localStorage.getItem('client_token');
      const res = await axios.get(`http://localhost:5000/api/client-portal/proposals/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProposal(res.data);
    } catch (err) {
      console.error('Failed to fetch proposal', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProposal();
  }, [id]);

  const handleAction = async (action: 'approve' | 'reject') => {
    if (!confirm(`Are you sure you want to ${action} this proposal?`)) return;
    
    setActionLoading(true);
    try {
      const token = localStorage.getItem('client_token');
      await axios.post(`http://localhost:5000/api/client-portal/proposals/${id}/${action}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchProposal();
    } catch (err) {
      console.error(`Failed to ${action} proposal`, err);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <ClientLayout><div className="py-20 text-center text-slate-500">Loading proposal details...</div></ClientLayout>;
  if (!proposal) return <ClientLayout><div className="py-20 text-center text-rose-400">Proposal not found.</div></ClientLayout>;

  return (
    <ClientLayout>
      <button 
        onClick={() => router.push('/client/dashboard')}
        className="flex items-center gap-2 text-slate-500 hover:text-white transition-colors mb-8 group"
      >
        <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
        <span className="font-semibold">Back to Dashboard</span>
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-card bg-[#0a0a14]/60 border border-white/5 rounded-[2.5rem] p-10 overflow-hidden relative">
            <div className="absolute top-0 right-0 p-8 opacity-5">
              <FileText size={160} />
            </div>
            
            <h1 className="text-3xl font-extrabold text-white mb-6 relative z-10">{proposal.title}</h1>
            
            <div className="prose prose-invert max-w-none relative z-10">
              <div className="bg-white/5 p-8 rounded-3xl border border-white/5 text-slate-300 leading-relaxed whitespace-pre-wrap font-serif text-lg">
                {proposal.content}
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar Info */}
        <div className="space-y-6">
          <div className="glass-card bg-[#0a0a14]/60 border border-white/5 rounded-3xl p-8 sticky top-8">
            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
              <ShieldCheck className="text-indigo-400" size={20} />
              Proposal Status
            </h3>
            
            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5">
                <span className="text-sm font-medium text-slate-400">Current Status</span>
                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-widest border ${
                  proposal.status === 'approved' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                  proposal.status === 'rejected' ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' :
                  'bg-yellow-500/10 border-yellow-500/20 text-yellow-400'
                }`}>
                  {proposal.status}
                </span>
              </div>

              <div className="flex items-center gap-3 px-1">
                <Calendar className="text-slate-500" size={16} />
                <div>
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none mb-1">Date Created</div>
                  <div className="text-sm font-semibold text-slate-300">{new Date(proposal.createdAt).toLocaleDateString()}</div>
                </div>
              </div>

              {proposal.status === 'draft' || proposal.status === 'sent' ? (
                <div className="space-y-3 pt-4 border-t border-white/5 mt-6">
                  <button 
                    onClick={() => handleAction('approve')}
                    disabled={actionLoading}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2"
                  >
                    {actionLoading ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle size={20} />}
                    <span>Approve Proposal</span>
                  </button>
                  <button 
                    onClick={() => handleAction('reject')}
                    disabled={actionLoading}
                    className="w-full bg-white/5 hover:bg-rose-500/10 hover:text-rose-400 text-slate-300 font-bold py-4 rounded-2xl transition-all border border-white/10 hover:border-rose-500/20 flex items-center justify-center gap-2"
                  >
                    {actionLoading ? <Loader2 className="animate-spin" size={20} /> : <XCircle size={20} />}
                    <span>Reject Proposal</span>
                  </button>
                </div>
              ) : (
                <div className={`p-4 rounded-2xl border flex items-center gap-3 ${
                  proposal.status === 'approved' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                }`}>
                  {proposal.status === 'approved' ? <CheckCircle size={20} /> : <XCircle size={20} />}
                  <span className="text-sm font-bold">This proposal has been {proposal.status}.</span>
                </div>
              )}

              <button className="w-full flex items-center justify-center gap-2 text-slate-500 hover:text-white transition-colors text-sm font-medium py-2">
                <Download size={16} />
                <span>Download as PDF</span>
              </button>
            </div>
          </div>

          <div className="p-6 rounded-3xl bg-indigo-500/5 border border-indigo-500/10">
            <div className="flex items-center gap-2 text-indigo-400 mb-3">
              <AlertTriangle size={16} />
              <span className="text-xs font-bold uppercase tracking-wider">Need Help?</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              If you have any questions regarding this proposal, please contact your account manager directly or call our support line.
            </p>
          </div>
        </div>
      </div>
    </ClientLayout>
  );
}
