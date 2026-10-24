'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import ClientLayout from '@/components/ClientLayout';
import api from '@/lib/api';
import ReactMarkdown from 'react-markdown';
import { formatEnumLabel, formatDate, formatDateTime } from '@/lib/format';
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

  if (loading)
    return (
      <ClientLayout>
        <div className="flex items-center justify-center gap-2 py-20 text-sm text-muted-foreground">
          <Loader2 className="animate-spin" size={18} />
          Loading proposal…
        </div>
      </ClientLayout>
    );
  if (!proposal)
    return (
      <ClientLayout>
        <div className="py-20 text-center text-sm font-semibold text-error">Proposal not found.</div>
      </ClientLayout>
    );

  const statusTone =
    proposal.status === 'approved'
      ? 'border-success/20 bg-success-wash text-success'
      : proposal.status === 'rejected'
        ? 'border-error/20 bg-error-wash text-error'
        : 'border-warning/20 bg-warning-wash text-warning';
  const canDecide = proposal.status === 'draft' || proposal.status === 'sent';

  return (
    <ClientLayout>
      <button
        onClick={() => router.push('/client/dashboard')}
        className="group mb-5 flex items-center gap-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft size={18} className="transition-transform group-hover:-translate-x-1" />
        <span>Back to Dashboard</span>
      </button>

      {error && (
        <div className="mb-5 rounded-[var(--radius)] border border-error/20 bg-error-wash px-4 py-3 text-sm font-medium text-error" role="alert">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-12">
        {/* Main column: document + comments */}
        <div className="space-y-5 lg:col-span-8">
          <div className="surface-card p-5 sm:p-6">
            <div className="mb-4 flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-primary/10 text-primary">
                <FileText size={20} />
              </span>
              <h1 className="min-w-0 break-words text-xl font-extrabold text-foreground sm:text-2xl">
                {proposal.title}
              </h1>
            </div>
            {/* Bounded height with internal scroll so the comments below stay
                reachable without scrolling past the entire document. */}
            <div className="rfp-document rounded-[var(--radius)] border border-border bg-muted lg:max-h-[62vh] lg:overflow-y-auto">
              <ReactMarkdown>{proposal.content}</ReactMarkdown>
            </div>
          </div>

          {/* Comments */}
          <div className="surface-card p-5 sm:p-6">
            <h3 className="mb-4 flex items-center gap-2 text-section-title">
              <MessageSquare className="text-primary" size={18} />
              Comments
            </h3>

            <div className="mb-4 max-h-[320px] space-y-3 overflow-y-auto pr-1">
              {comments.length === 0 ? (
                <div className="rounded-[var(--radius)] border border-dashed border-border bg-muted py-8 text-center text-sm italic text-muted-foreground">
                  No comments yet. Start the conversation below.
                </div>
              ) : (
                comments.map((comment) => (
                  <div
                    key={comment.id}
                    className={`rounded-[var(--radius)] border p-3 ${
                      comment.clientUserId
                        ? 'border-primary/20 bg-primary/[0.06] sm:ml-6'
                        : 'border-border bg-muted sm:mr-6'
                    }`}
                  >
                    <div className="mb-1.5 flex flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
                        {comment.clientUserId ? 'You' : 'Account Manager'}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {formatDateTime(comment.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm text-foreground">{comment.content}</p>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={handleAddComment} className="relative">
              <input
                type="text"
                className="w-full rounded-[var(--radius)] border border-border bg-card py-3 pl-4 pr-14 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary/40 focus:ring-2 focus:ring-ring/50"
                placeholder="Type your message…"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                required
              />
              <button
                type="submit"
                disabled={commentLoading}
                className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-[var(--radius-sm)] bg-primary text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
                aria-label="Post comment"
              >
                {commentLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              </button>
            </form>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-5 lg:col-span-4 lg:sticky lg:top-6">
          <div className="surface-card p-5 sm:p-6">
            <h3 className="mb-4 flex items-center gap-2 text-section-title">
              <ShieldCheck className="text-primary" size={18} />
              Proposal Status
            </h3>

            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-[var(--radius)] border border-border bg-muted p-3">
                <span className="text-sm font-medium text-muted-foreground">Current Status</span>
                <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest ${statusTone}`}>
                  {formatEnumLabel(proposal.status)}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <Calendar className="text-muted-foreground" size={16} />
                <div>
                  <div className="text-eyebrow leading-none">Date Created</div>
                  <div className="mt-1 text-sm font-semibold text-foreground">{formatDate(proposal.createdAt)}</div>
                </div>
              </div>

              {canDecide ? (
                <div className="mt-2 space-y-2.5 border-t border-border pt-4">
                  <button
                    onClick={() => handleAction('approve')}
                    disabled={actionLoading}
                    className="flex min-h-11 w-full items-center justify-center gap-2 rounded-[var(--radius)] bg-success px-4 py-2.5 text-sm font-bold text-white transition hover:bg-success/90 disabled:opacity-60"
                  >
                    {actionLoading ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle size={18} />}
                    <span>Approve Proposal</span>
                  </button>
                  <button
                    onClick={() => handleAction('reject')}
                    disabled={actionLoading}
                    className="flex min-h-11 w-full items-center justify-center gap-2 rounded-[var(--radius)] border border-border bg-card px-4 py-2.5 text-sm font-bold text-foreground transition hover:border-error/30 hover:bg-error-wash hover:text-error disabled:opacity-60"
                  >
                    {actionLoading ? <Loader2 className="animate-spin" size={18} /> : <XCircle size={18} />}
                    <span>Reject Proposal</span>
                  </button>
                </div>
              ) : (
                <div className={`flex items-center gap-3 rounded-[var(--radius)] border p-3 ${statusTone}`}>
                  {proposal.status === 'approved' ? <CheckCircle size={18} /> : <XCircle size={18} />}
                  <span className="text-sm font-bold">This proposal has been {formatEnumLabel(proposal.status).toLowerCase()}.</span>
                </div>
              )}

              <button
                onClick={handleDownload}
                className="flex w-full items-center justify-center gap-2 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                <Download size={16} />
                <span>Download as PDF</span>
              </button>
            </div>

            <div className="mt-6 border-t border-border pt-5">
              <h3 className="mb-3 flex items-center gap-2 text-eyebrow">
                <History className="text-primary" size={14} />
                Timeline
              </h3>
              <div className="space-y-3">
                {timeline.length === 0 ? (
                  <div className="text-xs italic text-muted-foreground">No activity recorded yet.</div>
                ) : (
                  timeline.map((item) => (
                    <div key={item.id} className="relative border-l border-border pb-2 pl-5 last:border-0 last:pb-0">
                      <div className="absolute left-[-4px] top-1 h-2 w-2 rounded-full bg-primary"></div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-foreground">{formatEnumLabel(item.action)}</div>
                      <div className="mb-0.5 text-[9px] text-muted-foreground">{formatDate(item.createdAt)}</div>
                      {item.details && <div className="text-[10px] italic leading-tight text-muted-foreground">{item.details}</div>}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="rounded-[var(--radius-lg)] border border-primary/15 bg-primary/5 p-5">
            <div className="mb-2 flex items-center gap-2 text-primary">
              <AlertTriangle size={16} />
              <span className="text-xs font-bold uppercase tracking-wider">Need Help?</span>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              If you have any questions regarding this proposal, please contact your account manager directly or call our support line.
            </p>
          </div>
        </div>
      </div>
    </ClientLayout>
  );
}
