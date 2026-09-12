'use client';

import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import DashboardLayout from '@/components/DashboardLayout';
import PageHeader from '@/components/PageHeader';
import LoadingState from '@/components/LoadingState';
import EmptyState from '@/components/EmptyState';
import StatusBadge from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { getApiErrorMessage } from '@/lib/api-error';
import api from '@/lib/api';
import {
  Plus,
  Sparkles,
  Send,
  Eye,
  FileText,
  Loader2,
  Users,
  Building2,
  Download,
  UserPlus,
  Trash2,
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
  companyName: string | null;
  email: string;
}

interface ProposalComment {
  id: string;
  content: string;
  userId: string | null;
  createdAt: string;
}

const selectClass =
  'h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none transition focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50';

export default function ProposalsPage() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);
  const [selectedLeadId, setSelectedLeadId] = useState('');
  const [clients, setClients] = useState<Client[]>([]);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [isCreatingClient, setIsCreatingClient] = useState(false);

  const [comments, setComments] = useState<ProposalComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [commentLoading, setCommentLoading] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareProposalId, setShareProposalId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);


  const fetchClients = async () => {
    setClientsLoading(true);
    try {
      const res = await api.get('clients');
      const nextClients: Client[] = Array.isArray(res.data) ? res.data : [];
      setClients(nextClients);
      return nextClients;
    } catch (err) {
      console.error('Failed to fetch clients', err);
      toast.error('Could not load clients. Please refresh or log in again.');
      setClients([]);
      return [];
    } finally {
      setClientsLoading(false);
    }
  };

  const fetchData = async () => {
    try {
      const [pRes, lRes, cRes] = await Promise.allSettled([
        api.get('proposals'),
        api.get('leads'),
        fetchClients(),
      ]);
      if (pRes.status === 'fulfilled') setProposals(pRes.value.data);
      if (lRes.status === 'fulfilled') setLeads(lRes.value.data);
      if (cRes.status === 'rejected') console.error('Failed to fetch clients', cRes.reason);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const openGenerateModal = () => {
    setSelectedClientId('');
    setShowModal(true);
    fetchClients();
  };

  const openShareModal = (proposalId: string) => {
    setShareProposalId(proposalId);
    setShowShareModal(true);
    fetchClients();
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

  const selectedLead = leads.find((lead) => lead.id === selectedLeadId);

  useEffect(() => {
    if (!selectedLead || selectedClientId) return;

    const leadEmail = selectedLead.email?.trim().toLowerCase();
    const leadCompany = selectedLead.company.trim().toLowerCase();

    const matchingClient = clients.find((client) => {
      const clientEmail = client.email?.trim().toLowerCase();
      const clientCompany = client.companyName?.trim().toLowerCase();
      return (leadEmail && clientEmail === leadEmail) || (leadCompany && clientCompany === leadCompany);
    });

    if (matchingClient) {
      setSelectedClientId(matchingClient.id);
    }
  }, [clients, selectedClientId, selectedLead]);

  const handleCreateClientFromLead = async () => {
    if (!selectedLead) {
      toast.error('Please select a lead first.');
      return;
    }
    if (!selectedLead.email) {
      toast.error('This lead needs an email before it can become a client.');
      return;
    }

    setIsCreatingClient(true);
    try {
      const res = await api.post('clients', {
        name: selectedLead.name,
        companyName: selectedLead.company,
        email: selectedLead.email,
      });
      const nextClients = await fetchClients();
      setSelectedClientId(res.data?.id || nextClients[0]?.id || '');
      toast.success('Client created for this workspace.');
    } catch (err) {
      console.error(err);
      toast.error(getApiErrorMessage(err, 'Could not create client from this lead.'));
    } finally {
      setIsCreatingClient(false);
    }
  };

  const handleGenerateForLead = async () => {
    if (!selectedLeadId) {
      toast.error('Please select a lead first.');
      return;
    }
    setIsGenerating(true);
    try {
      await api.post('proposals/generate', {
        leadId: selectedLeadId,
        clientId: selectedClientId || undefined,
      });
      toast.success('AI proposal generated successfully.');
      setShowModal(false);
      setSelectedLeadId('');
      setSelectedClientId('');
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error(getApiErrorMessage(err, 'Generation failed. Check your Gemini API key.'));
    } finally {
      setIsGenerating(false);
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
      toast.error('Failed to add comment.');
    } finally {
      setCommentLoading(false);
    }
  };

  const handleShare = async (proposalId: string, clientId: string) => {
    if (!clientId) return;
    try {
      await api.post(`proposals/${proposalId}/share`, { clientId });
      toast.success('Proposal shared with the client portal.');
      setShowShareModal(false);
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error('Failed to share proposal.');
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
      toast.error('Failed to download PDF.');
    }
  };

  const getLeadInfo = (proposal: Proposal) => proposal.lead ?? leads.find((l) => l.id === proposal.leadId);

  const handleDeleteProposal = async (proposalId: string, title: string) => {
    if (!confirm(`Delete proposal "${title}"? This can't be undone.`)) return;

    setDeletingId(proposalId);
    try {
      await api.delete(`proposals/${proposalId}`);
      setProposals((prev) => prev.filter((p) => p.id !== proposalId));
      if (selectedProposal?.id === proposalId) {
        setShowViewModal(false);
        setSelectedProposal(null);
      }
      toast.success('Proposal deleted.');
    } catch (err) {
      console.error(err);
      toast.error(getApiErrorMessage(err, 'Failed to delete proposal.'));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <DashboardLayout>
      <PageHeader
        title="Proposals"
        description="AI-powered proposal generation and email delivery."
        actions={
          <Button onClick={openGenerateModal}>
            <Plus size={16} />
            Generate for Lead
          </Button>
        }
      />

      {loading ? (
        <div className="rounded-[var(--radius-lg)] border border-border bg-card shadow-sm">
          <LoadingState label="Loading proposals..." />
        </div>
      ) : proposals.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="No proposals yet"
          description='Use "Generate for Lead" to create an AI-powered proposal for a lead.'
          action={
            <Button onClick={openGenerateModal}>
              <Plus size={16} />
              Generate for Lead
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {proposals.map((p) => {
            const lead = getLeadInfo(p);
            return (
              <div
                key={p.id}
                className="flex flex-col rounded-[var(--radius-lg)] border border-border bg-card p-5 shadow-sm transition hover:border-primary/30"
              >
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/8 text-primary">
                    <FileText size={18} />
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <StatusBadge status={p.status} />
                    <span className="text-[10px] font-semibold text-muted-foreground">v{p._count?.versions || 1}</span>
                  </div>
                </div>

                <h3 className="mb-1 truncate text-base font-semibold text-foreground">{p.title}</h3>

                {lead && (
                  <div className="mb-1 flex items-center gap-2">
                    <Users size={13} className="shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span className="truncate text-xs text-muted-foreground">
                      {lead.name} &middot; {lead.company}
                    </span>
                  </div>
                )}
                {p.client && (
                  <div className="mb-3 flex items-center gap-2">
                    <Building2 size={13} className="shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span className="truncate text-xs text-muted-foreground">Client: {p.client.name}</span>
                  </div>
                )}

                <p className="mb-5 line-clamp-3 rounded-lg bg-muted p-3 text-xs text-muted-foreground">{p.content}</p>

                <div className="mt-auto flex items-center justify-between border-t border-border pt-4">
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => {
                        setSelectedProposal(p);
                        setShowViewModal(true);
                      }}
                      aria-label="View full proposal"
                      title="View full proposal"
                    >
                      <Eye size={16} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => openShareModal(p.id)}
                      aria-label="Share with client"
                      title="Share with client"
                    >
                      <Send size={16} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleDownload(p.id)}
                      aria-label="Download PDF"
                      title="Download PDF"
                    >
                      <Download size={16} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-error hover:bg-error-wash hover:text-error"
                      onClick={() => handleDeleteProposal(p.id, p.title)}
                      disabled={deletingId === p.id}
                      aria-label="Delete proposal"
                      title="Delete proposal"
                    >
                      {deletingId === p.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                    </Button>
                  </div>
                  <span className="text-[10px] text-muted-foreground">{new Date(p.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Share dialog */}
      <Dialog open={showShareModal} onOpenChange={setShowShareModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Share with client</DialogTitle>
            <DialogDescription>The proposal becomes visible in the selected client&apos;s portal.</DialogDescription>
          </DialogHeader>
          <select
            className={selectClass}
            defaultValue=""
            onChange={(e) => shareProposalId && handleShare(shareProposalId, e.target.value)}
            disabled={clientsLoading || clients.length === 0}
          >
            <option value="">
              {clientsLoading ? 'Loading clients...' : clients.length === 0 ? 'No clients in this workspace' : 'Select a client'}
            </option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.companyName})
              </option>
            ))}
          </select>
          <div className="mt-2 flex justify-end">
            <Button variant="outline" onClick={() => setShowShareModal(false)}>
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Generate dialog */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles size={18} className="text-primary" aria-hidden="true" />
              Generate AI proposal
            </DialogTitle>
            <DialogDescription>
              Select a lead. The AI analyzes their company and drafts a personalized security proposal.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">Select lead</label>
              <select
                value={selectedLeadId}
                onChange={(e) => {
                  setSelectedLeadId(e.target.value);
                  setSelectedClientId('');
                }}
                className={selectClass}
              >
                <option value="">Choose a lead</option>
                {leads.map((lead) => (
                  <option key={lead.id} value={lead.id}>
                    {lead.name} — {lead.company}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">Link to client (optional)</label>
              <select
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                className={selectClass}
                disabled={clientsLoading || clients.length === 0}
              >
                <option value="">
                  {clientsLoading
                    ? 'Loading clients...'
                    : clients.length === 0
                      ? 'No clients in this workspace'
                      : 'Choose a client'}
                </option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name} — {client.companyName || 'No company'}
                  </option>
                ))}
              </select>
              {clients.length === 0 && !clientsLoading && (
                <div className="rounded-lg border border-border bg-muted p-4">
                  <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
                    Clients are workspace-specific. Create one from the selected lead to link this proposal.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleCreateClientFromLead}
                    disabled={!selectedLeadId || isCreatingClient}
                  >
                    {isCreatingClient ? <Loader2 className="animate-spin" size={14} /> : <UserPlus size={14} />}
                    {isCreatingClient ? 'Creating...' : 'Create client from lead'}
                  </Button>
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 flex flex-col-reverse gap-3 border-t border-border pt-6 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleGenerateForLead} disabled={isGenerating || !selectedLeadId}>
              {isGenerating ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
              {isGenerating ? 'Generating...' : 'Generate proposal'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* View dialog */}
      <Dialog open={showViewModal} onOpenChange={setShowViewModal}>
        <DialogContent className="flex max-h-[90vh] w-full flex-col overflow-hidden p-0 sm:max-w-5xl">
          {selectedProposal && (
            <>
              <DialogHeader className="border-b border-border p-5 text-left sm:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <DialogTitle className="truncate">{selectedProposal.title}</DialogTitle>
                    <DialogDescription>Document and client communication</DialogDescription>
                  </div>
                  <div className="mr-8 flex shrink-0 gap-1">
                    <Button
                      variant="outline"
                      size="icon-sm"
                      onClick={() => handleDownload(selectedProposal.id)}
                      aria-label="Download PDF"
                    >
                      <Download size={16} />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon-sm"
                      className="text-error hover:bg-error-wash hover:text-error"
                      onClick={() => handleDeleteProposal(selectedProposal.id, selectedProposal.title)}
                      disabled={deletingId === selectedProposal.id}
                      aria-label="Delete proposal"
                    >
                      {deletingId === selectedProposal.id ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Trash2 size={16} />
                      )}
                    </Button>
                  </div>
                </div>
              </DialogHeader>

              <div className="grid flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-3 lg:overflow-hidden">
                <div className="border-b border-border p-5 sm:p-6 lg:col-span-2 lg:border-b-0 lg:border-r lg:overflow-y-auto">
                  <div className="rfp-document rounded-lg border border-border bg-muted">
                    <ReactMarkdown>{selectedProposal.content}</ReactMarkdown>
                  </div>
                </div>

                <div className="flex h-full flex-col bg-background">
                  <div className="border-b border-border p-4">
                    <h4 className="text-eyebrow">Communication</h4>
                  </div>
                  <div className="max-h-80 flex-1 space-y-3 overflow-y-auto p-4 lg:max-h-none">
                    {comments.length === 0 ? (
                      <p className="py-10 text-center text-xs text-muted-foreground">No comments yet.</p>
                    ) : (
                      comments.map((c) => (
                        <div
                          key={c.id}
                          className={`rounded-lg border border-border p-3 ${c.userId ? 'bg-primary/[0.04]' : 'ml-4 bg-success-wash'}`}
                        >
                          <div className="mb-1 flex justify-between">
                            <span className="text-[10px] font-bold text-primary">{c.userId ? 'Admin' : 'Client'}</span>
                            <span className="text-[10px] text-muted-foreground">
                              {new Date(c.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-xs text-foreground">{c.content}</p>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="border-t border-border p-4">
                    <form
                      className="relative"
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleAddComment(selectedProposal.id);
                      }}
                    >
                      <Input
                        type="text"
                        placeholder="Add a comment..."
                        className="pr-11"
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                      />
                      <Button
                        type="submit"
                        size="icon-sm"
                        className="absolute right-1 top-1"
                        disabled={commentLoading || !newComment.trim()}
                        aria-label="Post comment"
                      >
                        {commentLoading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                      </Button>
                    </form>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
