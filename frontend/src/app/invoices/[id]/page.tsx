'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import api from '@/lib/api';
import { getApiErrorMessage } from '@/lib/api-error';
import { cancelInvoice, getAdminInvoice, Invoice, issueInvoice, markInvoicePaid } from '@/lib/invoices';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Download,
  FileWarning,
  Loader2,
  MapPin,
  Receipt,
  Send,
  ShieldCheck,
  XCircle,
} from 'lucide-react';

const statusClass: Record<string, string> = {
  draft: 'border-amber-400/20 bg-amber-400/10 text-amber-300',
  issued: 'border-sky-400/20 bg-sky-400/10 text-sky-300',
  disputed: 'border-orange-400/20 bg-orange-400/10 text-orange-300',
  resolved: 'border-violet-400/20 bg-violet-400/10 text-violet-300',
  paid: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300',
  cancelled: 'border-slate-400/20 bg-slate-400/10 text-slate-300',
};

const disputeStatusClass: Record<string, string> = {
  open: 'border-amber-400/20 bg-amber-400/10 text-amber-300',
  under_review: 'border-violet-400/20 bg-violet-400/10 text-violet-300',
  resolved: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300',
  rejected: 'border-rose-400/20 bg-rose-400/10 text-rose-300',
};

function formatDate(value: string | null) {
  if (!value) return 'N/A';
  return new Date(value).toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDateTime(value: string | null) {
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

function formatRateSource(value: string) {
  if (value === 'site_rate_card') return 'Site rate card';
  if (value === 'client_rate_card') return 'Client rate card';
  return 'Manual rate';
}

export default function InvoiceDetailPage() {
  const params = useParams<{ id: string }>();
  const invoiceId = Array.isArray(params.id) ? params.id[0] : params.id;
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchInvoice = async () => {
      if (!invoiceId) return;

      setLoading(true);
      try {
        setInvoice(await getAdminInvoice(invoiceId));
        setError('');
      } catch (err) {
        setError(getApiErrorMessage(err, 'Could not load this invoice.'));
      } finally {
        setLoading(false);
      }
    };

    fetchInvoice();
  }, [invoiceId]);

  const handleIssue = async () => {
    if (!invoice) return;

    setWorking(true);
    setError('');

    try {
      setInvoice(await issueInvoice(invoice.id));
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not issue invoice.'));
    } finally {
      setWorking(false);
    }
  };

  const handleMarkPaid = async () => {
    if (!invoice) return;

    setWorking(true);
    setError('');

    try {
      setInvoice(await markInvoicePaid(invoice.id));
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not mark invoice paid.'));
    } finally {
      setWorking(false);
    }
  };

  const handleCancel = async () => {
    if (!invoice) return;

    setWorking(true);
    setError('');

    try {
      setInvoice(await cancelInvoice(invoice.id));
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not cancel invoice.'));
    } finally {
      setWorking(false);
    }
  };

  const handleDownload = async () => {
    if (!invoice) return;

    setWorking(true);
    setError('');

    try {
      const response = await api.get(`invoices/${invoice.id}/export-pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${invoice.invoiceNumber}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not download invoice PDF.'));
    } finally {
      setWorking(false);
    }
  };

  const showInternalAdjustments = invoice
    ? Object.prototype.hasOwnProperty.call(invoice, 'internalAdjustments')
    : false;

  return (
    <DashboardLayout>
      <div className="mb-6">
        <Link href="/invoices" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-400 transition hover:text-white">
          <ArrowLeft size={16} />
          Back to invoices
        </Link>
      </div>

      {loading ? (
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] py-24 text-center text-slate-500">
          <Loader2 className="mx-auto mb-3 animate-spin text-indigo-300" size={28} />
          Loading invoice...
        </div>
      ) : error || !invoice ? (
        <div className="rounded-3xl border border-rose-500/20 bg-rose-500/10 p-6 text-rose-300">
          <div className="flex items-center gap-3">
            <AlertTriangle size={20} />
            {error || 'Invoice not found.'}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 sm:p-8">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <span className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-widest ${statusClass[invoice.status] || statusClass.draft}`}>
                {invoice.status}
              </span>
              <span className="rounded-full border border-indigo-400/20 bg-indigo-400/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-indigo-200">
                {formatDate(invoice.billingStartDate)} - {formatDate(invoice.billingEndDate)}
              </span>
            </div>

            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h1 className="flex items-start gap-3 break-words text-2xl font-extrabold text-white sm:text-3xl">
                  <Receipt className="mt-0.5 shrink-0 text-indigo-300" size={30} />
                  {invoice.invoiceNumber}
                </h1>
                <p className="mt-3 text-slate-400">
                  {invoice.client?.companyName || invoice.client?.name || 'Client'} - {invoice.site?.name || 'Site'}
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                {['draft', 'resolved'].includes(invoice.status) && (
                  <button
                    type="button"
                    onClick={handleIssue}
                    disabled={working}
                    className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-sky-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-sky-400 disabled:opacity-60"
                  >
                    {working ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
                    {invoice.status === 'resolved' ? 'Reissue' : 'Issue'}
                  </button>
                )}
                {['issued', 'resolved'].includes(invoice.status) && (
                  <button
                    type="button"
                    onClick={handleMarkPaid}
                    disabled={working}
                    className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-emerald-400 disabled:opacity-60"
                  >
                    {working ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
                    Mark Paid
                  </button>
                )}
                {!['paid', 'cancelled'].includes(invoice.status) && (
                  <button
                    type="button"
                    onClick={handleCancel}
                    disabled={working}
                    className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-rose-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-rose-400 disabled:opacity-60"
                  >
                    {working ? <Loader2 className="animate-spin" size={16} /> : <XCircle size={16} />}
                    Cancel
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleDownload}
                  disabled={working}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-white/5 px-4 py-3 text-sm font-bold text-slate-200 transition hover:bg-white/10 disabled:opacity-60"
                >
                  <Download size={16} />
                  Download PDF
                </button>
              </div>
            </div>
          </section>

          {error && (
            <div className="flex items-center gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-5 py-4 text-sm font-semibold text-rose-300">
              <AlertTriangle size={18} />
              {error}
            </div>
          )}

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
              <div className="text-xs font-bold uppercase tracking-widest text-slate-500">Worked Hours</div>
              <div className="mt-2 text-3xl font-black text-white">{invoice.totalHours}</div>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
              <div className="text-xs font-bold uppercase tracking-widest text-slate-500">Rate</div>
              <div className="mt-2 text-3xl font-black text-white">{formatMoney(invoice.hourlyRate)}</div>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
              <div className="text-xs font-bold uppercase tracking-widest text-slate-500">Rate Source</div>
              <div className="mt-2 text-lg font-black text-white">{formatRateSource(invoice.rateSource)}</div>
              <div className="mt-1 text-xs text-slate-500">{invoice.rateCard?.roleName || invoice.rateCard?.id || 'No rate card'}</div>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
              <div className="text-xs font-bold uppercase tracking-widest text-slate-500">Subtotal</div>
              <div className="mt-2 text-3xl font-black text-white">{formatMoney(invoice.subtotal)}</div>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
              <div className="text-xs font-bold uppercase tracking-widest text-slate-500">Total</div>
              <div className="mt-2 text-3xl font-black text-white">{formatMoney(invoice.totalAmount)}</div>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
              <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500">
                <MapPin size={14} />
                Site
              </div>
              <div className="text-lg font-bold text-white">{invoice.site?.name || 'Site'}</div>
              <div className="mt-1 text-sm text-slate-400">{invoice.site?.address || 'No address listed'}</div>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
              <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500">
                <CalendarDays size={14} />
                Dates
              </div>
              <div className="text-lg font-bold text-white">Issued {formatDate(invoice.issuedAt)}</div>
              <div className="mt-1 text-sm text-slate-400">Created {formatDate(invoice.createdAt)}</div>
            </div>
          </section>

          {showInternalAdjustments && (
            <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 sm:p-6">
              <div className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-500">
                Internal Adjustments
              </div>
              <p className="whitespace-pre-wrap text-sm leading-6 text-slate-300">
                {invoice.internalAdjustments || 'No internal adjustments recorded.'}
              </p>
            </section>
          )}

          <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-xl font-bold text-white">
                <FileWarning className="text-amber-300" size={20} />
                Dispute History
              </h2>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-bold text-slate-300">
                {invoice.disputes.length}
              </span>
            </div>

            {invoice.disputes.length === 0 ? (
              <div className="py-8 text-center text-slate-500">No disputes recorded for this invoice.</div>
            ) : (
              <div className="space-y-3">
                {invoice.disputes.map((dispute) => (
                  <article key={dispute.id} className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${disputeStatusClass[dispute.status] || disputeStatusClass.open}`}>
                            {dispute.status.replace('_', ' ')}
                          </span>
                          <span className="text-xs font-semibold text-slate-500">{formatDate(dispute.createdAt)}</span>
                        </div>
                        <div className="mt-3 font-bold text-white">{dispute.reason}</div>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-300">{dispute.description}</p>
                        {dispute.adminResponse && (
                          <p className="mt-3 whitespace-pre-wrap rounded-2xl border border-white/5 bg-black/10 p-3 text-sm leading-6 text-slate-300">
                            {dispute.adminResponse}
                          </p>
                        )}
                      </div>
                      <Link
                        href={`/invoice-disputes/${dispute.id}`}
                        className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-xs font-bold text-slate-200 transition hover:bg-white/10"
                      >
                        Review <ArrowRight size={14} />
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 sm:p-6">
            <h2 className="mb-4 text-xl font-bold text-white">Invoice Items</h2>
            {invoice.items.length === 0 ? (
              <div className="py-10 text-center text-slate-500">No invoice items recorded.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="responsive-table w-full text-left">
                  <thead>
                    <tr className="border-b border-white/5 text-sm uppercase tracking-wider text-muted-foreground">
                      <th className="px-4 py-3 font-semibold">Guard</th>
                      <th className="px-4 py-3 font-semibold">Shift</th>
                      <th className="px-4 py-3 font-semibold">Hours</th>
                      <th className="px-4 py-3 font-semibold">Rate</th>
                      <th className="px-4 py-3 text-right font-semibold">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {invoice.items.map((item) => (
                      <tr key={item.id}>
                        <td className="px-4 py-4" data-label="Guard">
                          <div className="flex items-center gap-2 font-bold text-white">
                            <ShieldCheck size={15} className="text-emerald-300" />
                            {item.guard?.name || 'Guard'}
                          </div>
                          <div className="mt-1 text-xs text-slate-500">{item.guard?.email || item.guard?.phone || 'No contact listed'}</div>
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-300" data-label="Shift">
                          {formatDateTime(item.shift?.startTime || null)}
                          <div className="mt-1 text-slate-500">to {formatDateTime(item.shift?.endTime || null)}</div>
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-300" data-label="Hours">{item.workedHours}</td>
                        <td className="px-4 py-4 text-sm text-slate-300" data-label="Rate">
                          {formatMoney(item.hourlyRate)}
                          <div className="mt-1 text-xs text-slate-500">{item.rateCard?.roleName || formatRateSource(invoice.rateSource)}</div>
                        </td>
                        <td className="px-4 py-4 text-right text-sm font-bold text-white" data-label="Amount">{formatMoney(item.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </DashboardLayout>
  );
}
