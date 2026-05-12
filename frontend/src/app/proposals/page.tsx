'use client';

import React, { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import api from '@/lib/api';
import { 
  Plus, 
  Sparkles, 
  Send, 
  Eye, 
  Mail,
  FileText,
  Loader2,
  Zap,
  Users,
  X,
  CheckCircle2,
  AlertCircle,
  Building2,
  Download
} from 'lucide-react';

interface Lead {
  id: string;
  name: string;
  email: string | null;
  company: string;
  status: string;
}

interface Proposal {
  id: string;
  title: string;
  content: string;
  status: string;
  leadId: string | null;
  lead?: Lead;
  createdAt: string;
  clientId: string | null;
  client?: { name: string; companyName: string };
  _count?: { versions: number };
}

interface Client {
  id: string;
  name: string;
  companyName: string;
  email: string;
}

export default function ProposalsPage() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isBulkGenerating, setIsBulkGenerating] = useState(false);
  const [isSendingBulk, setIsSendingBulk] = useState(false);
  const [sendingEmailId, setSendingEmailId] = useState<string | null>(null);
  
  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);
  const [selectedLeadId, setSelectedLeadId] = useState('');
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [commentLoading, setCommentLoading] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareProposalId, setShareProposalId] = useState<string | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchData = async () => {
    try {
      const [pRes, lRes, cRes] = await Promise.all([
        api.get('proposals'),
        api.get('leads'),
        api.get('clients')
      ]);
      setProposals(pRes.data);
      setLeads(lRes.data);
      setClients(cRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchComments = async (proposalId: string) => {
    try {
      const res = await api.get(`proposals/${proposalId}/comments`);
      setComments(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (showViewModal && selectedProposal) {
      fetchComments(selectedProposal.id);
    }
  }, [showViewModal, selectedProposal]);

  const handleGenerateForLead = async () => {
    if (!selectedLeadId) {
      showToast('Please select a lead first.', 'error');
      return;
    }
    setIsGenerating(true);
    try {
      await api.post('proposals/generate', { 
        leadId: selectedLeadId,
        clientId: selectedClientId || undefined
      });
      showToast('AI Proposal generated successfully!', 'success');
      setShowModal(false);
      setSelectedLeadId('');
      setSelectedClientId('');
      fetchData();
    } catch (err: any) {
      console.error(err);
      showToast(err.response?.data?.message || 'Generation failed. Check your Gemini API key.', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleBulkGenerate = async () => {
    if (!confirm('This will generate AI proposals for all leads that don\'t have one yet. Continue?')) return;
    setIsBulkGenerating(true);
    try {
      const res = await api.post('proposals/generate-bulk');
      showToast(`Generated ${res.data.generatedCount} proposals out of ${res.data.totalProcessed} leads.`, 'success');
      fetchData();
    } catch (err: any) {
      console.error(err);
      showToast(err.response?.data?.message || 'Bulk generation failed.', 'error');
    } finally {
      setIsBulkGenerating(false);
    }
  };

  const handleSendEmail = async (leadId: string) => {
    setSendingEmailId(leadId);
    try {
      const res = await api.post('email/send', { leadId });
      showToast(`Email sent! ${res.data.previewUrl ? 'Preview: ' + res.data.previewUrl : ''}`, 'success');
    } catch (err: any) {
      console.error(err);
      showToast(err.response?.data?.message || 'Failed to send email.', 'error');
    } finally {
      setSendingEmailId(null);
    }
  };

  const handleBulkSendEmails = async () => {
    if (!confirm('This will send proposal emails to ALL leads with email addresses and proposals. Are you sure?')) return;
    setIsSendingBulk(true);
    try {
      const res = await api.post('email/send-bulk');
      showToast(`Sent ${res.data.sentCount} emails out of ${res.data.totalProcessed} eligible leads.`, 'success');
    } catch (err: any) {
      console.error(err);
      showToast(err.response?.data?.message || 'Bulk email failed.', 'error');
    } finally {
      setIsSendingBulk(false);
    }
  };

  const handleAddComment = async (proposalId: string) => {
    if (!newComment.trim()) return;
    setCommentLoading(true);
    try {
      await api.post(`proposals/${proposalId}/comments`, { content: newComment });
      setNewComment('');
      fetchComments(proposalId);
    } catch (err) {
      console.error(err);
    } finally {
      setCommentLoading(false);
    }
  };

  const handleShare = async (proposalId: string, clientId: string) => {
    try {
      await api.post(`proposals/${proposalId}/share`, { clientId });
      showToast('Proposal shared with client portal!', 'success');
      setShowShareModal(false);
      fetchData();
    } catch (err) {
      console.error(err);
      showToast('Failed to share proposal.', 'error');
    }
  };

  const handleDownload = async (proposalId: string) => {
    try {
      const response = await api.get(`proposals/${proposalId}/export`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `proposal-${proposalId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error(err);
      showToast('Failed to download PDF.', 'error');
    }
  };

  const getLeadInfo = (proposal: Proposal) => {
    if (proposal.lead) return proposal.lead;
    return leads.find(l => l.id === proposal.leadId);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
      case 'sent': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'approved': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'rejected': return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      default: return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
    }
  };

  return (
    <DashboardLayout>
      {toast && (
        <div className={`fixed top-6 right-6 z-[200] flex items-center gap-3 px-5 py-4 rounded-2xl shadow-2xl border transition-all animate-in slide-in-from-right ${
          toast.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
          <span className="text-sm font-medium max-w-sm">{toast.message}</span>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h2 className="text-3xl font-bold">Proposals</h2>
          <p className="text-muted-foreground">AI-powered proposal generation and email delivery.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button onClick={handleBulkGenerate} disabled={isBulkGenerating} className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold py-3 px-5 rounded-2xl transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50">
            {isBulkGenerating ? <Loader2 className="animate-spin" size={18} /> : <Zap size={18} />}
            <span>Bulk Generate AI</span>
          </button>
          <button onClick={handleBulkSendEmails} disabled={isSendingBulk} className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold py-3 px-5 rounded-2xl transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50">
            {isSendingBulk ? <Loader2 className="animate-spin" size={18} /> : <Mail size={18} />}
            <span>Send Bulk Emails</span>
          </button>
          <button onClick={() => setShowModal(true)} className="bg-primary hover:bg-indigo-500 text-white font-bold py-3 px-6 rounded-2xl transition-all shadow-lg flex items-center justify-center gap-2">
            <Plus size={20} />
            <span>Generate for Lead</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full py-20 text-center text-muted-foreground animate-pulse leading-10">Formatting documents...</div>
        ) : proposals.length === 0 ? (
          <div className="col-span-full py-20 text-center text-muted-foreground border-2 border-dashed border-white/5 rounded-3xl">
            <Sparkles className="mx-auto mb-4 text-indigo-400" size={48} />
            <p className="text-lg font-semibold mb-2">No proposals yet</p>
            <p className="text-sm">Use the &quot;Generate for Lead&quot; button or &quot;Bulk Generate AI&quot; to get started!</p>
          </div>
        ) : proposals.map((p) => {
          const lead = getLeadInfo(p);
          return (
            <div key={p.id} className="glass-card rounded-3xl p-6 flex flex-col group hover:border-indigo-500/20 transition-all">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
                  <FileText size={20} />
                </div>
                <div className="flex flex-col items-end gap-1">
                   <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest border ${getStatusColor(p.status)}`}>
                    {p.status}
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest border bg-white/5 text-muted-foreground border-white/10">
                    v{p._count?.versions || 1}
                  </span>
                </div>
              </div>
              <h4 className="text-xl font-bold mb-1 truncate">{p.title}</h4>

              {lead && (
                <div className="flex items-center gap-2 mb-1">
                  <Users size={14} className="text-indigo-400" />
                  <span className="text-xs text-muted-foreground">{lead.name} · {lead.company}</span>
                </div>
              )}
              {p.client && (
                <div className="flex items-center gap-2 mb-3">
                  <Building2 size={14} className="text-emerald-400" />
                  <span className="text-xs text-muted-foreground">Client: {p.client.name}</span>
                </div>
              )}
              <p className="text-xs text-muted-foreground line-clamp-3 mb-6 bg-white/5 p-3 rounded-xl border border-white/5">
                {p.content}
              </p>
              <div className="mt-auto pt-4 border-t border-white/5 flex items-center justify-between">
                <div className="flex gap-2">
                  <button title="View Full Proposal" onClick={() => { setSelectedProposal(p); setShowViewModal(true); }} className="p-2 hover:bg-white/10 rounded-lg transition-colors text-muted-foreground hover:text-white">
                    <Eye size={18} />
                  </button>
                  <button title="Share with Client" onClick={() => { setShareProposalId(p.id); setShowShareModal(true); }} className="p-2 hover:bg-indigo-500/10 rounded-lg transition-colors text-indigo-400 hover:text-indigo-300">
                    <Send size={18} />
                  </button>
                  <button title="Download PDF" onClick={() => handleDownload(p.id)} className="p-2 hover:bg-white/10 rounded-lg transition-colors text-muted-foreground hover:text-white">
                    <Download size={18} />
                  </button>
                </div>
                <span className="text-[10px] text-muted-foreground">{new Date(p.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          );
        })}
      </div>

      {showShareModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[100] p-4 text-left">
          <div className="glass-card w-full max-w-md rounded-3xl p-8 border-white/10 shadow-3xl bg-[#0e0e1a]">
            <h3 className="text-2xl font-bold mb-6 text-white">Share with Client</h3>
            <div className="space-y-4">
              <select
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-primary/50 text-white"
                onChange={(e) => handleShare(shareProposalId!, e.target.value)}
              >
                <option value="" className="bg-gray-900">-- Select Client --</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id} className="bg-gray-900">{c.name} ({c.companyName})</option>
                ))}
              </select>
              <button onClick={() => setShowShareModal(false)} className="w-full bg-white/5 hover:bg-white/10 text-white font-bold py-3 rounded-2xl transition-all border border-white/10">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[100] p-4 text-left">
          <div className="glass-card w-full max-w-lg rounded-3xl p-8 border-white/10 shadow-3xl bg-[#0e0e1a]">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold flex items-center gap-3 text-white">
                <Sparkles className="text-indigo-400" size={24} />
                Generate AI Proposal
              </h3>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                <X size={20} className="text-muted-foreground hover:text-white" />
              </button>
            </div>

            <p className="text-sm text-muted-foreground mb-6">
              Select a lead below. Our AI will analyze their company and generate a personalized, professional security proposal automatically.
            </p>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Select Lead</label>
                <select
                  value={selectedLeadId}
                  onChange={(e) => setSelectedLeadId(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-primary/50 appearance-none text-white"
                >
                  <option value="" className="bg-gray-900">-- Choose a Lead --</option>
                  {leads.map(lead => (
                    <option key={lead.id} value={lead.id} className="bg-gray-900">
                      {lead.name} — {lead.company}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Link to Client (Optional)</label>
                <select
                  value={selectedClientId}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-primary/50 appearance-none text-white"
                >
                  <option value="" className="bg-gray-900">-- Choose a Client --</option>
                  {clients.map(client => (
                    <option key={client.id} value={client.id} className="bg-gray-900">
                      {client.name} — {client.companyName}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-4 pt-6 mt-6 border-t border-white/5">
              <button type="button" onClick={() => setShowModal(false)} className="flex-1 bg-white/5 hover:bg-white/10 text-white font-bold py-3 rounded-2xl transition-all border border-white/10">
                Cancel
              </button>
              <button onClick={handleGenerateForLead} disabled={isGenerating || !selectedLeadId} className="flex-1 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-400 hover:to-purple-400 text-white font-bold py-3 rounded-2xl transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50">
                {isGenerating ? <Loader2 className="animate-spin" size={20} /> : <Sparkles size={20} />}
                <span>{isGenerating ? 'Generating...' : 'Generate Proposal'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {showViewModal && selectedProposal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[100] p-4 text-left">
          <div className="glass-card w-full max-w-5xl max-h-[90vh] overflow-hidden rounded-3xl flex flex-col border-white/10 shadow-3xl bg-[#0e0e1a]">
            <div className="p-8 border-b border-white/5 flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-bold text-white">{selectedProposal.title}</h3>
                <p className="text-sm text-muted-foreground">Version History & Communication</p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => handleDownload(selectedProposal.id)} className="p-2 bg-white/5 hover:bg-white/10 rounded-xl transition-colors text-white">
                  <Download size={20} />
                </button>
                <button onClick={() => setShowViewModal(false)} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                  <X size={20} className="text-muted-foreground hover:text-white" />
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-3">
              <div className="lg:col-span-2 overflow-y-auto p-8 border-r border-white/5">
                <div className="prose prose-invert max-w-none whitespace-pre-wrap text-sm leading-relaxed bg-white/5 p-8 rounded-3xl border border-white/5 text-slate-300">
                  {selectedProposal.content}
                </div>
              </div>
              
              <div className="flex flex-col h-full bg-black/20">
                <div className="p-6 border-b border-white/5 bg-white/5">
                  <h4 className="text-sm font-bold uppercase tracking-widest text-indigo-400">Communication</h4>
                </div>
                
                <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                  {comments.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground italic text-xs">No comments yet.</div>
                  ) : comments.map((c) => (
                    <div key={c.id} className={`p-4 rounded-2xl border ${c.userId ? 'bg-indigo-500/5 border-indigo-500/10' : 'bg-emerald-500/5 border-emerald-500/10 ml-4'}`}>
                      <div className="flex justify-between mb-1">
                        <span className="text-[10px] font-bold text-indigo-400">{c.userId ? 'Admin' : 'Client'}</span>
                        <span className="text-[10px] text-muted-foreground">{new Date(c.createdAt).toLocaleDateString()}</span>
                      </div>
                      <p className="text-xs text-slate-300">{c.content}</p>
                    </div>
                  ))}
                </div>
                
                <div className="p-6 border-t border-white/5">
                  <div className="relative">
                    <input 
                      type="text" 
                      placeholder="Add a comment..."
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-4 pr-12 text-sm focus:outline-none focus:ring-1 focus:ring-primary text-white"
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                    />
                    <button onClick={() => handleAddComment(selectedProposal.id)} disabled={commentLoading} className="absolute right-2 top-1.5 p-1.5 bg-primary rounded-lg text-white disabled:opacity-50">
                      {commentLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
