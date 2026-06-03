'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { getApiErrorMessage } from '@/lib/api-error';
import { getAdminIncident, Incident, reviewIncident as submitIncidentReview } from '@/lib/incidents';
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ExternalLink,
  FileWarning,
  Loader2,
  MapPin,
  ShieldCheck,
  XCircle,
} from 'lucide-react';

const severityClass: Record<string, string> = {
  low: 'border-slate-400/20 bg-slate-400/10 text-slate-300',
  medium: 'border-amber-400/20 bg-amber-400/10 text-amber-300',
  high: 'border-orange-400/20 bg-orange-400/10 text-orange-300',
  critical: 'border-rose-400/20 bg-rose-400/10 text-rose-300',
};

const statusClass: Record<string, string> = {
  submitted: 'border-sky-400/20 bg-sky-400/10 text-sky-300',
  under_review: 'border-violet-400/20 bg-violet-400/10 text-violet-300',
  approved: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300',
  rejected: 'border-rose-400/20 bg-rose-400/10 text-rose-300',
};

export default function IncidentReviewDetailPage() {
  const params = useParams<{ id: string }>();
  const incidentId = Array.isArray(params.id) ? params.id[0] : params.id;
  const [incident, setIncident] = useState<Incident | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const fetchIncident = async () => {
      if (!incidentId) return;

      setLoading(true);
      try {
        const data = await getAdminIncident(incidentId);
        setIncident(data);
        setReviewNote(data.reviewNote || '');
        setError('');
      } catch (err) {
        setError(getApiErrorMessage(err, 'Could not load this incident for review.'));
      } finally {
        setLoading(false);
      }
    };

    fetchIncident();
  }, [incidentId]);

  const formatDate = (value: string) => new Date(value).toLocaleString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const handleReview = async (status: 'approved' | 'rejected') => {
    if (!incidentId || !incident) return;

    setReviewing(true);
    setError('');
    setSuccess('');

    try {
      const updated = await submitIncidentReview(incidentId, {
        status,
        review_note: reviewNote.trim() || undefined,
      });
      setIncident(updated);
      setReviewNote(updated.reviewNote || '');
      setSuccess(`Incident ${status}.`);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not complete the incident review.'));
    } finally {
      setReviewing(false);
    }
  };

  const canReview = incident?.status === 'submitted' || incident?.status === 'under_review';

  return (
    <DashboardLayout>
      <div className="mb-6">
        <Link href="/incidents/review" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-400 transition hover:text-white">
          <ArrowLeft size={16} />
          Back to review queue
        </Link>
      </div>

      {loading ? (
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] py-24 text-center text-slate-500">
          <Loader2 className="mx-auto mb-3 animate-spin text-indigo-300" size={28} />
          Loading incident...
        </div>
      ) : error && !incident ? (
        <div className="rounded-3xl border border-rose-500/20 bg-rose-500/10 p-6 text-rose-300">
          <div className="flex items-center gap-3">
            <AlertTriangle size={20} />
            {error}
          </div>
        </div>
      ) : incident ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="space-y-6">
            <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 sm:p-8">
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <span className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-widest ${severityClass[incident.severity] || severityClass.low}`}>
                  {incident.severity}
                </span>
                <span className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-widest ${statusClass[incident.status] || statusClass.submitted}`}>
                  {incident.status}
                </span>
              </div>

              <h1 className="flex items-start gap-3 break-words text-2xl font-extrabold text-white sm:text-3xl">
                <FileWarning className="mt-0.5 shrink-0 text-amber-300" size={30} />
                {incident.title}
              </h1>
              <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-300">{incident.description}</p>
            </section>

            <section className="grid gap-4 md:grid-cols-2">
              <div className="min-w-0 rounded-3xl border border-white/10 bg-white/[0.04] p-5">
                <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500">
                  <MapPin size={14} />
                  Site
                </div>
                <div className="text-lg font-bold text-white">{incident.site.name}</div>
                <div className="mt-1 text-sm text-slate-400">{incident.site.address}</div>
              </div>

              <div className="min-w-0 rounded-3xl border border-white/10 bg-white/[0.04] p-5">
                <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500">
                  <ShieldCheck size={14} />
                  Guard
                </div>
                <div className="text-lg font-bold text-white">{incident.guard.name}</div>
                <div className="mt-1 text-sm text-slate-400">{incident.guard.phone || incident.guard.email || 'No contact listed'}</div>
              </div>

              <div className="min-w-0 rounded-3xl border border-white/10 bg-white/[0.04] p-5">
                <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500">
                  <CalendarDays size={14} />
                  Occurrence Time
                </div>
                <div className="text-lg font-bold text-white">{formatDate(incident.occurredAt)}</div>
              </div>

              <div className="min-w-0 rounded-3xl border border-white/10 bg-white/[0.04] p-5">
                <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500">
                  <CalendarDays size={14} />
                  Submitted
                </div>
                <div className="text-lg font-bold text-white">{formatDate(incident.submittedAt || incident.createdAt)}</div>
              </div>

              <div className="min-w-0 rounded-3xl border border-white/10 bg-white/[0.04] p-5 md:col-span-2">
                <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500">
                  <CalendarDays size={14} />
                  Shift
                </div>
                <div className="text-sm text-slate-300">{formatDate(incident.shift.startTime)}</div>
                <div className="mt-1 text-sm text-slate-400">to {formatDate(incident.shift.endTime)}</div>
              </div>
            </section>

            {incident.attachmentUrl && (
              <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
                <h2 className="mb-3 text-lg font-bold text-white">Attachment</h2>
                <a
                  href={incident.attachmentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl bg-white/5 px-4 py-3 text-sm font-bold text-indigo-200 transition hover:bg-white/10"
                >
                  Open attachment <ExternalLink size={16} />
                </a>
              </section>
            )}

            {incident.notes && (
              <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
                <h2 className="mb-3 text-lg font-bold text-white">Guard Notes</h2>
                <p className="whitespace-pre-wrap text-sm leading-7 text-slate-300">{incident.notes}</p>
              </section>
            )}

            <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-white">
                <BookOpen className="text-sky-300" size={20} />
                Similar Historical Cases
              </h2>
              {incident.similarHistoricalCases?.length ? (
                <div className="space-y-3">
                  {incident.similarHistoricalCases.map((entry) => (
                    <div key={entry.id} className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-sky-400/20 bg-sky-400/10 px-2.5 py-1 text-xs font-bold uppercase tracking-widest text-sky-200">
                          {entry.category.replace('_', ' ')}
                        </span>
                        {entry.sourceType && (
                          <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-semibold text-slate-300">
                            {entry.sourceType}
                          </span>
                        )}
                      </div>
                      <div className="font-bold text-white">{entry.title}</div>
                      <p className="mt-2 text-sm leading-6 text-slate-300">{entry.summary}</p>
                      {entry.tags.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {entry.tags.slice(0, 4).map((tag) => (
                            <span key={tag} className="rounded-full bg-white/5 px-2 py-1 text-xs text-slate-300">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 py-10 text-center text-sm text-slate-500">
                  No similar historical cases found.
                </div>
              )}
            </section>
          </div>

          <aside className="h-fit rounded-3xl border border-white/10 bg-white/[0.04] p-5">
            <h2 className="text-xl font-bold text-white">Review Decision</h2>

            {error && (
              <div className="mt-4 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-3 text-sm text-rose-300">
                {error}
              </div>
            )}

            {success && (
              <div className="mt-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-300">
                {success}
              </div>
            )}

            <div className="mt-5">
              <label htmlFor="review-note" className="text-sm font-semibold text-slate-300">
                Review note
              </label>
              <textarea
                id="review-note"
                value={reviewNote}
                onChange={(event) => setReviewNote(event.target.value)}
                disabled={!canReview || reviewing}
                rows={6}
                className="mt-2 w-full resize-none rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
                placeholder="Add supervisor/admin notes for the review record."
              />
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <button
                type="button"
                onClick={() => handleReview('approved')}
                disabled={!canReview || reviewing}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {reviewing ? <Loader2 className="animate-spin" size={17} /> : <CheckCircle2 size={17} />}
                Approve
              </button>
              <button
                type="button"
                onClick={() => handleReview('rejected')}
                disabled={!canReview || reviewing}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-rose-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-rose-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {reviewing ? <Loader2 className="animate-spin" size={17} /> : <XCircle size={17} />}
                Reject
              </button>
            </div>

            {!canReview && (
              <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
                Finalized {incident.reviewedAt ? formatDate(incident.reviewedAt) : 'previously'}
                {incident.reviewedBy?.name || incident.reviewedBy?.email ? ` by ${incident.reviewedBy.name || incident.reviewedBy.email}` : ''}.
              </div>
            )}
          </aside>
        </div>
      ) : null}
    </DashboardLayout>
  );
}
