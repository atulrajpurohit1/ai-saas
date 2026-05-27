'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import ClientLayout from '@/components/ClientLayout';
import api from '@/lib/api';
import { getApiErrorMessage } from '@/lib/api-error';
import { getClientInvoice, Invoice } from '@/lib/invoices';
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  Download,
  Loader2,
  MapPin,
  Receipt,
  ShieldCheck,
} from 'lucide-react';

const statusClass: Record<string, string> = {
  issued: 'border-sky-400/20 bg-sky-400/10 text-sky-300',
  paid: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300',
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

export default function ClientInvoiceDetailPage() {
  const params = useParams<{ id: string }>();
  const invoiceId = Array.isArray(params.id) ? params.id[0] : params.id;
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchInvoice = async () => {
      if (!invoiceId) return;

      setLoading(true);
      try {
        setInvoice(await getClientInvoice(invoiceId));
        setError('');
      } catch (err) {
        setError(getApiErrorMessage(err, 'Could not load this invoice.'));
      } finally {
        setLoading(false);
      }
    };

    fetchInvoice();
  }, [invoiceId]);

  const handleDownload = async () => {
    if (!invoice) return;

    setDownloading(true);
    setError('');

    try {
      const response = await api.get(`client/invoices/${invoice.id}/download`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${invoice.invoiceNumber}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not download this invoice.'));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <ClientLayout>
      <div className="mb-6">
        <Link href="/client/invoices" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-400 transition hover:text-white">
          <ArrowLeft size={16} />
          Back to invoices
        </Link>
      </div>

      {loading ? (
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] py-24 text-center text-slate-500">
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
          <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 sm:p-8">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <span className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-widest ${statusClass[invoice.status] || statusClass.issued}`}>
                {invoice.status}
              </span>
              <span className="rounded-full border border-indigo-400/20 bg-indigo-400/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-indigo-200">
                {formatDate(invoice.billingStartDate)} - {formatDate(invoice.billingEndDate)}
              </span>
            </div>

            <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
              <div>
                <h1 className="flex items-start gap-3 break-words text-2xl font-extrabold text-white sm:text-3xl">
                  <Receipt className="mt-0.5 shrink-0 text-indigo-300" size={30} />
                  {invoice.invoiceNumber}
                </h1>
                <p className="mt-3 text-slate-400">{invoice.site?.name || 'Linked site'}</p>
              </div>

              <button
                type="button"
                onClick={handleDownload}
                disabled={downloading}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-indigo-500 disabled:opacity-60"
              >
                {downloading ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />}
                Download PDF
              </button>
            </div>
          </section>

          {error && (
            <div className="flex items-center gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-5 py-4 text-sm font-semibold text-rose-300">
              <AlertTriangle size={18} />
              {error}
            </div>
          )}

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
              <div className="text-xs font-bold uppercase tracking-widest text-slate-500">Worked Hours</div>
              <div className="mt-2 text-3xl font-black text-white">{invoice.totalHours}</div>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
              <div className="text-xs font-bold uppercase tracking-widest text-slate-500">Subtotal</div>
              <div className="mt-2 text-3xl font-black text-white">{formatMoney(invoice.subtotal)}</div>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
              <div className="text-xs font-bold uppercase tracking-widest text-slate-500">Tax</div>
              <div className="mt-2 text-3xl font-black text-white">{formatMoney(invoice.tax)}</div>
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
                Issued
              </div>
              <div className="text-lg font-bold text-white">{formatDate(invoice.issuedAt)}</div>
              <div className="mt-1 text-sm text-slate-400">Created {formatDate(invoice.createdAt)}</div>
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 sm:p-6">
            <h2 className="mb-4 text-xl font-bold text-white">Shift Work Summary</h2>
            {invoice.items.length === 0 ? (
              <div className="py-10 text-center text-slate-500">No invoice items recorded.</div>
            ) : (
              <div className="space-y-4">
                {invoice.items.map((item) => (
                  <article key={item.id} className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
                    <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-2 font-bold text-white">
                        <ShieldCheck size={15} className="text-emerald-300" />
                        {item.guard?.name || 'Guard'}
                      </div>
                      <span className="text-sm font-bold text-white">{formatMoney(item.amount)}</span>
                    </div>
                    <div className="grid gap-3 text-xs text-slate-400 sm:grid-cols-4">
                      <div>
                        <div className="font-bold uppercase tracking-widest text-slate-600">Shift</div>
                        <div className="mt-1">{formatDateTime(item.shift?.startTime || null)}</div>
                      </div>
                      <div>
                        <div className="font-bold uppercase tracking-widest text-slate-600">End</div>
                        <div className="mt-1">{formatDateTime(item.shift?.endTime || null)}</div>
                      </div>
                      <div>
                        <div className="font-bold uppercase tracking-widest text-slate-600">Hours</div>
                        <div className="mt-1">{item.workedHours}</div>
                      </div>
                      <div>
                        <div className="font-bold uppercase tracking-widest text-slate-600">Rate</div>
                        <div className="mt-1">{formatMoney(item.hourlyRate)}</div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </ClientLayout>
  );
}
