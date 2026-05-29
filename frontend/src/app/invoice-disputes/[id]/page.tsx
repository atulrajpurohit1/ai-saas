'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { getApiErrorMessage } from '@/lib/api-error';
import {
  AdminInvoiceDispute,
  getInvoiceDispute,
  rejectInvoiceDispute,
  resolveInvoiceDispute,
  respondToInvoiceDispute,
} from '@/lib/invoice-disputes';
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  FileWarning,
  Loader2,
  Receipt,
  Send,
  XCircle,
} from 'lucide-react';

const disputeStatusClass: Record<string, string> = {
  open: 'border-amber-400/20 bg-amber-400/10 text-amber-300',
  under_review: 'border-violet-400/20 bg-violet-400/10 text-violet-300',
  resolved: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300',
  rejected: 'border-rose-400/20 bg-rose-400/10 text-rose-300',
};

const invoiceStatusClass: Record<string, string> = {
  draft: 'border-amber-400/20 bg-amber-400/10 text-amber-300',
  issued: 'border-sky-400/20 bg-sky-400/10 text-sky-300',
  disputed: 'border-orange-400/20 bg-orange-400/10 text-orange-300',
  resolved: 'border-violet-400/20 bg-violet-400/10 text-violet-300',
  paid: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300',
  cancelled: 'border-slate-400/20 bg-slate-400/10 text-slate-300',
};

function formatDate(value: string | null) {
  if (!value) return 'N/A';
  return new Date(value).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatMoney(value: number) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
  }).format(value);
}

export default function InvoiceDisputeDetailPage() {
  const params = useParams<{ id: string }>();
  const disputeId = Array.isArray(params.id) ? params.id[0] : params.id;
  const [dispute, setDispute] = useState<AdminInvoiceDispute | null>(null);
  const [adminResponse, setAdminResponse] = useState('');
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const fetchDispute = async () => {
      if (!disputeId) return;

      setLoading(true);
      try {
        const data = await getInvoiceDispute(disputeId);
        setDispute(data);
        setAdminResponse(data.adminResponse || '');
        setError('');
      } catch (err) {
        setError(getApiErrorMessage(err, 'Could not load this invoice dispute.'));
      } finally {
        setLoading(false);
      }
    };

    fetchDispute();
  }, [disputeId]);

  const handleAction = async (action: 'respond' | 'resolve' | 'reject') => {
    if (!disputeId || !dispute) return;

    setWorking(true);
    setError('');
    setSuccess('');

    try {
      const response = adminResponse.trim();
      const updated =
        action === 'respond'
          ? await respondToInvoiceDispute(disputeId, response)
          : action === 'resolve'
            ? await resolveInvoiceDispute(disputeId, response || undefined)
            : await rejectInvoiceDispute(disputeId, response || undefined);
      setDispute(updated);
      setAdminResponse(updated.adminResponse || '');
      setSuccess(
        action === 'respond'
          ? 'Response saved.'
          : action === 'resolve'
            ? 'Dispute resolved.'
            : 'Dispute rejected.',
      );
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not update this dispute.'));
    } finally {
      setWorking(false);
    }
  };

  const canReview = dispute?.status === 'open' || dispute?.status === 'under_review';

  return (
    <DashboardLayout>
      <div className="mb-6">
        <Link href="/invoice-disputes" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-400 transition hover:text-white">
          <ArrowLeft size={16} />
          Back to disputes
        </Link>
      </div>

      {loading ? (
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] py-24 text-center text-slate-500">
          <Loader2 className="mx-auto mb-3 animate-spin text-indigo-300" size={28} />
          Loading dispute...
        </div>
      ) : error && !dispute ? (
        <div className="rounded-3xl border border-rose-500/20 bg-rose-500/10 p-6 text-rose-300">
          <div className="flex items-center gap-3">
            <AlertTriangle size={20} />
            {error}
          </div>
        </div>
      ) : dispute ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_390px]">
          <div className="space-y-6">
            <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 sm:p-8">
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <span className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-widest ${disputeStatusClass[dispute.status] || disputeStatusClass.open}`}>
                  {dispute.status.replace('_', ' ')}
                </span>
                <span className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-widest ${invoiceStatusClass[dispute.invoice?.status || 'draft'] || invoiceStatusClass.draft}`}>
                  Invoice {dispute.invoice?.status || 'unknown'}
                </span>
              </div>

              <h1 className="flex items-start gap-3 break-words text-2xl font-extrabold text-white sm:text-3xl">
                <FileWarning className="mt-0.5 shrink-0 text-amber-300" size={30} />
                {dispute.reason}
              </h1>
              <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-300">{dispute.description}</p>
            </section>

            <section className="grid gap-4 md:grid-cols-2">
              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
                <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500">
                  <Receipt size={14} />
                  Invoice
                </div>
                <Link href={`/invoices/${dispute.invoiceId}`} className="text-lg font-bold text-white transition hover:text-indigo-200">
                  {dispute.invoice?.invoiceNumber || 'Invoice'}
                </Link>
                <div className="mt-1 text-sm text-slate-400">{dispute.invoice ? formatMoney(dispute.invoice.totalAmount) : 'N/A'}</div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
                <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500">
                  <CalendarDays size={14} />
                  Submitted
                </div>
                <div className="text-lg font-bold text-white">{formatDate(dispute.createdAt)}</div>
                <div className="mt-1 text-sm text-slate-400">Resolved {formatDate(dispute.resolvedAt)}</div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
                <div className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-500">Client</div>
                <div className="text-lg font-bold text-white">{dispute.client?.companyName || dispute.client?.name || 'Client'}</div>
                <div className="mt-1 text-sm text-slate-400">{dispute.client?.email || 'No email listed'}</div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
                <div className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-500">Site</div>
                <div className="text-lg font-bold text-white">{dispute.invoice?.site?.name || 'Linked site'}</div>
                <div className="mt-1 text-sm text-slate-400">{dispute.invoice?.site?.address || 'No address listed'}</div>
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
              <h2 className="mb-3 text-lg font-bold text-white">Admin Response</h2>
              <p className="whitespace-pre-wrap text-sm leading-7 text-slate-300">
                {dispute.adminResponse || 'No admin response has been sent yet.'}
              </p>
            </section>
          </div>

          <aside className="h-fit rounded-3xl border border-white/10 bg-white/[0.04] p-5">
            <h2 className="text-xl font-bold text-white">Dispute Workflow</h2>

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
              <label htmlFor="admin-response" className="text-sm font-semibold text-slate-300">
                Admin response
              </label>
              <textarea
                id="admin-response"
                value={adminResponse}
                onChange={(event) => setAdminResponse(event.target.value)}
                disabled={!canReview || working}
                rows={7}
                className="mt-2 w-full resize-none rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
                placeholder="Share the review outcome with the client."
              />
            </div>

            <div className="mt-5 grid gap-3">
              <button
                type="button"
                onClick={() => handleAction('respond')}
                disabled={!canReview || working || !adminResponse.trim()}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-sky-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {working ? <Loader2 className="animate-spin" size={17} /> : <Send size={17} />}
                Respond
              </button>
              <button
                type="button"
                onClick={() => handleAction('resolve')}
                disabled={!canReview || working}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {working ? <Loader2 className="animate-spin" size={17} /> : <CheckCircle2 size={17} />}
                Resolve
              </button>
              <button
                type="button"
                onClick={() => handleAction('reject')}
                disabled={!canReview || working}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-rose-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-rose-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {working ? <Loader2 className="animate-spin" size={17} /> : <XCircle size={17} />}
                Reject
              </button>
            </div>
          </aside>
        </div>
      ) : null}
    </DashboardLayout>
  );
}
