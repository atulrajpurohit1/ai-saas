'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import ClientLayout from '@/components/ClientLayout';
import api from '@/lib/api';
import { 
  FileText, 
  CheckCircle, 
  XCircle, 
  ArrowLeft, 
  Download, 
  Calendar,
  AlertTriangle,
  Loader2,
  ShieldCheck,
  MessageSquare,
  Send,
  History,
} from 'lucide-react';

interface Proposal {
  id: string;
  title: string;
  content: string;
  status: string;
  createdAt: string;
}

interface Comment {
  id: string;
  content: string;
  userId?: string;
  clientUserId?: string;
  createdAt: string;
}

interface TimelineItem {
  id: string;
  action: string;
  details?: string;
  createdAt: string;
}

export default function ClientProposalView() {
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const router = useRouter();
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [commentLoading, setCommentLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchProposalData = useCallback(async () => {
    if (!id) {
      setLoading(false);
      return;
    }

    try {
      const [pRes, cRes, tRes] = await Promise.allSettled([
        api.get(`client-portal/proposals/${id}`),
        api.get(`client-portal/proposals/${id}/comments`),
        api.get(`client-portal/proposals/${id}/timeline`)
      ]);

      if (pRes.status !== 'fulfilled') {
        throw pRes.reason;
      }

      setProposal(pRes.value.data);
      setComments(cRes.status === 'fulfilled' && Array.isArray(cRes.value.data) ? cRes.value.data : []);
      setTimeline(tRes.status === 'fulfilled' && Array.isArray(tRes.value.data) ? tRes.value.data : []);
      setError(cRes.status === 'rejected' || tRes.status === 'rejected' ? 'Proposal loaded, but activity could not be refreshed.' : '');
    } catch (err) {
      console.error('Failed to fetch proposal data', err);
      setError('Could not load proposal activity. Please refresh or sign in again.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchProposalData();
  }, [fetchProposalData]);

  const handleAction = async (action: 'approve' | 'reject') => {
    if (!id) return;

    if (!confirm(`Are you sure you want to ${action} this proposal?`)) return;
    
    setActionLoading(true);
    try {
      await api.post(`client-portal/proposals/${id}/${action}`);
      setError('');
      await fetchProposalData();
    } catch (err) {
      console.error(`Failed to ${action} proposal`, err);
      setError(`Could not ${action} this proposal. Please try again.`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    if (!id) return;

    setCommentLoading(true);
    try {
      await api.post(`client-portal/proposals/${id}/comments`, { content: newComment.trim() });
      setNewComment('');
      setError('');
      await fetchProposalData();
    } catch (err) {
      console.error('Failed to add comment', err);
      setError('Could not add your comment. Please try again.');
    } finally {
      setCommentLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!id) return;

    try {
      const response = await api.get(`client-portal/proposals/${id}/export`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `proposal-${id}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Failed to download PDF', err);
      setError('Could not download the PDF. Please try again.');
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

      {error && (
        <div className="mb-6 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-5 py-4 text-sm font-medium text-rose-300">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-8">
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

          {/* Comments Section */}
          <div className="glass-card bg-[#0a0a14]/40 border border-white/5 rounded-3xl p-8">
            <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <MessageSquare className="text-indigo-400" size={20} />
              Comments
            </h3>

            <div className="space-y-4 mb-8 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {comments.length === 0 ? (
                <div className="text-center py-10 text-slate-500 bg-white/5 rounded-2xl border border-dashed border-white/10 italic">
                  No comments yet. Start the conversation below.
                </div>
              ) : comments.map((comment) => (
                <div 
                  key={comment.id} 
                  className={`p-4 rounded-2xl border ${
                    comment.clientUserId 
                      ? 'bg-indigo-500/10 border-indigo-500/20 ml-8' 
                      : 'bg-white/5 border-white/10 mr-8'
                  }`}
                >
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-400">
                      {comment.clientUserId ? 'You' : 'Account Manager'}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {new Date(comment.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm text-slate-300">{comment.content}</p>
                </div>
              ))}
            </div>

            <form onSubmit={handleAddComment} className="relative group">
              <input 
                type="text" 
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-6 pr-14 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all placeholder:text-slate-600"
                placeholder="Type your message..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                required
              />
              <button 
                type="submit" 
                disabled={commentLoading}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-500 transition-all disabled:opacity-50"
              >
                {commentLoading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
              </button>
            </form>
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

              <button 
                onClick={handleDownload}
                className="w-full flex items-center justify-center gap-2 text-slate-500 hover:text-white transition-colors text-sm font-medium py-2"
              >
                <Download size={16} />
                <span>Download as PDF</span>
              </button>
            </div>

            {/* Timeline in Sidebar */}
            <div className="mt-8 pt-8 border-t border-white/5">
              <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                <History className="text-indigo-400" size={16} />
                Timeline
              </h3>
              <div className="space-y-4">
                {timeline.length === 0 ? (
                  <div className="text-xs text-slate-500 italic">No activity recorded yet.</div>
                ) : timeline.map((item) => (
                  <div key={item.id} className="relative pl-6 pb-2 border-l border-white/10 last:border-0 last:pb-0">
                    <div className="absolute left-[-5px] top-1 w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]"></div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{item.action.replace(/_/g, ' ')}</div>
                    <div className="text-[9px] text-slate-500 mb-1">{new Date(item.createdAt).toLocaleDateString()}</div>
                    {item.details && <div className="text-[10px] text-slate-500 leading-tight italic">{item.details}</div>}
                  </div>
                ))}
              </div>
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
