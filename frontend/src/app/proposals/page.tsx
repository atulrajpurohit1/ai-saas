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
  AlertCircle
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
  
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchData = async () => {
    try {
      const [pRes, lRes] = await Promise.all([
        api.get('proposals'),
        api.get('leads')
      ]);
      setProposals(pRes.data);
      setLeads(lRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Generate proposal for a single lead
  const handleGenerateForLead = async () => {
    if (!selectedLeadId) {
      showToast('Please select a lead first.', 'error');
      return;
    }
    setIsGenerating(true);
    try {
      await api.post('proposals/generate', { leadId: selectedLeadId });
      showToast('AI Proposal generated successfully!', 'success');
      setShowModal(false);
      setSelectedLeadId('');
      fetchData();
    } catch (err: any) {
      console.error(err);
      showToast(err.response?.data?.message || 'Generation failed. Check your OpenAI API key.', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  // Bulk generate proposals for all leads without one
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

  // Send email to a single lead
  const handleSendEmail = async (leadId: string) => {
    setSendingEmailId(leadId);
    try {
      const res = await api.post('email/send', { leadId });
      showToast(`Email sent! ${res.data.previewUrl ? 'Preview: ' + res.data.previewUrl : ''}`, 'success');
    } catch (err: any) {
      console.error(err);
      showToast(err.response?.data?.message || 'Failed to send email. Make sure the lead has an email address.', 'error');
    } finally {
      setSendingEmailId(null);
    }
  };

  // Bulk send emails
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

  // Find the lead name for a proposal
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
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-6 right-6 z-[200] flex items-center gap-3 px-5 py-4 rounded-2xl shadow-2xl border transition-all animate-in slide-in-from-right ${
          toast.type === 'success' 
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
            : 'bg-red-500/10 border-red-500/20 text-red-400'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
          <span className="text-sm font-medium max-w-sm">{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h2 className="text-3xl font-bold">Proposals</h2>
          <p className="text-muted-foreground">AI-powered proposal generation and email delivery.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button 
            onClick={handleBulkGenerate}
            disabled={isBulkGenerating}
            className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold py-3 px-5 rounded-2xl transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isBulkGenerating ? <Loader2 className="animate-spin" size={18} /> : <Zap size={18} />}
            <span>Bulk Generate AI</span>
          </button>
          <button 
            onClick={handleBulkSendEmails}
            disabled={isSendingBulk}
            className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold py-3 px-5 rounded-2xl transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isSendingBulk ? <Loader2 className="animate-spin" size={18} /> : <Mail size={18} />}
            <span>Send Bulk Emails</span>
          </button>
          <button 
            onClick={() => setShowModal(true)}
            className="bg-primary hover:bg-indigo-500 text-white font-bold py-3 px-6 rounded-2xl transition-all shadow-lg flex items-center justify-center gap-2"
          >
            <Plus size={20} />
            <span>Generate for Lead</span>
          </button>
        </div>
      </div>

      {/* Proposal Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full py-20 text-center text-muted-foreground animate-pulse leading-10">Formatting documents...</div>
        ) : proposals.length === 0 ? (
          <div className="col-span-full py-20 text-center text-muted-foreground border-2 border-dashed border-white/5 rounded-3xl">
            <Sparkles className="mx-auto mb-4 text-indigo-400" size={48} />
            <p className="text-lg font-semibold mb-2">No proposals yet</p>
            <p className="text-sm">Use the &quot;Generate for Lead&quot; button or &quot;Bulk Generate AI&quot; to get started!</p>
          </div>
        ) : proposals.map((p: any) => {
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
                <div className="flex items-center gap-2 mb-3">
                  <Users size={14} className="text-indigo-400" />
                  <span className="text-xs text-muted-foreground">{lead.name} · {lead.company}</span>
                </div>
              )}
              <p className="text-xs text-muted-foreground line-clamp-3 mb-6 bg-white/5 p-3 rounded-xl border border-white/5">
                {p.content}
              </p>
              <div className="mt-auto pt-4 border-t border-white/5 flex items-center justify-between">
                <div className="flex gap-2">
                  <button 
                    title="View Full Proposal" 
                    onClick={() => { setSelectedProposal(p); setShowViewModal(true); }}
                    className="p-2 hover:bg-white/10 rounded-lg transition-colors text-muted-foreground hover:text-white"
                  >
                    <Eye size={18} />
                  </button>
                  {lead && lead.email && (
                    <button 
                      title="Send via Email" 
                      onClick={() => handleSendEmail(p.leadId!)}
                      disabled={sendingEmailId === p.leadId}
                      className="p-2 hover:bg-emerald-500/10 rounded-lg transition-colors text-emerald-400 hover:text-emerald-300 disabled:opacity-50"
                    >
                      {sendingEmailId === p.leadId ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
                    </button>
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground">{new Date(p.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* GENERATE FOR LEAD MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[100] p-4">
          <div className="glass-card w-full max-w-lg rounded-3xl p-8 border-white/10 shadow-3xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold flex items-center gap-3">
                <Sparkles className="text-indigo-400" size={24} />
                Generate AI Proposal
              </h3>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                <X size={20} />
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
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-primary/50 appearance-none"
                >
                  <option value="" className="bg-gray-900">-- Choose a Lead --</option>
                  {leads.map(lead => (
                    <option key={lead.id} value={lead.id} className="bg-gray-900">
                      {lead.name} — {lead.company} {lead.email ? `(${lead.email})` : '(no email)'}
                    </option>
                  ))}
                </select>
              </div>

              {selectedLeadId && (
                <div className="p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/10">
                  <p className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                    <Sparkles size={14} />
                    What will happen
                  </p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• AI will analyze the lead&apos;s company profile</li>
                    <li>• A professional security proposal will be drafted</li>
                    <li>• The proposal will be saved and linked to this lead</li>
                  </ul>
                </div>
              )}
            </div>

            <div className="flex gap-4 pt-6 mt-6 border-t border-white/5">
              <button 
                type="button"
                onClick={() => setShowModal(false)}
                className="flex-1 bg-white/5 hover:bg-white/10 text-white font-bold py-3 rounded-2xl transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={handleGenerateForLead}
                disabled={isGenerating || !selectedLeadId}
                className="flex-1 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-400 hover:to-purple-400 text-white font-bold py-3 rounded-2xl transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isGenerating ? <Loader2 className="animate-spin" size={20} /> : <Sparkles size={20} />}
                <span>{isGenerating ? 'Generating...' : 'Generate Proposal'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW PROPOSAL MODAL */}
      {showViewModal && selectedProposal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[100] p-4">
          <div className="glass-card w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl p-8 border-white/10 shadow-3xl">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-2xl font-bold">{selectedProposal.title}</h3>
                {(() => {
                  const lead = getLeadInfo(selectedProposal);
                  return lead ? (
                    <p className="text-sm text-muted-foreground mt-1">
                      For: {lead.name} · {lead.company}
                    </p>
                  ) : null;
                })()}
              </div>
              <button onClick={() => setShowViewModal(false)} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="prose prose-invert max-w-none whitespace-pre-wrap text-sm leading-relaxed bg-white/5 p-6 rounded-2xl border border-white/5">
              {selectedProposal.content}
            </div>
            <div className="flex gap-4 pt-6 mt-6 border-t border-white/5">
              <button 
                onClick={() => setShowViewModal(false)}
                className="flex-1 bg-white/5 hover:bg-white/10 text-white font-bold py-3 rounded-2xl transition-all"
              >
                Close
              </button>
              {selectedProposal.leadId && (
                <button 
                  onClick={() => { handleSendEmail(selectedProposal.leadId!); setShowViewModal(false); }}
                  className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold py-3 rounded-2xl transition-all shadow-lg flex items-center justify-center gap-2"
                >
                  <Send size={18} />
                  <span>Send via Email</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
