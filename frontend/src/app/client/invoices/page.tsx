'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import ClientLayout from '@/components/ClientLayout';
import api from '@/lib/api';
import { getApiErrorMessage } from '@/lib/api-error';
import { getClientInvoices, Invoice } from '@/lib/invoices';
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  Download,
  Loader2,
  MapPin,
  Receipt,
  Search,
} from 'lucide-react';

const statusClass: Record<string, string> = {
  issued: 'border-sky-400/20 bg-sky-400/10 text-sky-300',
  disputed: 'border-orange-400/20 bg-orange-400/10 text-orange-300',
  resolved: 'border-violet-400/20 bg-violet-400/10 text-violet-300',
  paid: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300',
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatMoney(value: number) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
  }).format(value);
}

export default function ClientInvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState('');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchInvoices = async () => {
      try {
        const data = await getClientInvoices();
        setInvoices(Array.isArray(data) ? data : []);
        setError('');
      } catch (err) {
        setError(getApiErrorMessage(err, 'Could not load invoices.'));
      } finally {
        setLoading(false);
      }
    };

    fetchInvoices();
  }, []);

  const filteredInvoices = useMemo(() => {
    const normalized = search.toLowerCase();
    return invoices.filter((invoice) => {
      const invoiceNumber = invoice.invoiceNumber || '';
      const siteName = invoice.site?.name || '';
      return invoiceNumber.toLowerCase().includes(normalized) || siteName.toLowerCase().includes(normalized);
    });
  }, [invoices, search]);

  const handleDownload = async (invoice: Invoice) => {
    setDownloadingId(invoice.id);
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
      setDownloadingId('');
    }
  };

  return (
    <ClientLayout>
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="flex items-center gap-3 text-2xl font-bold tracking-tight text-white sm:text-3xl">
            <Receipt className="text-indigo-300" size={28} />
            Invoices
          </h2>
          <p className="mt-2 font-medium text-slate-400">Issued billing invoices for your linked sites.</p>
        </div>
      </div>

      <div className="mb-8 overflow-hidden rounded-[2rem] border border-white/5 bg-[#0a0a14]/60">
        <div className="border-b border-white/5 bg-white/5 p-4 sm:p-6">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
            <input
              type="text"
              placeholder="Search invoices..."
              className="w-full rounded-2xl border border-white/10 bg-white/5 py-3 pl-12 pr-4 text-white transition-all placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>

        <div className="p-3 sm:p-4">
          {loading ? (
            <div className="py-20 text-center text-slate-500">
              <Loader2 className="mx-auto mb-4 animate-spin" size={32} />
              <p>Loading invoices...</p>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center gap-3 rounded-3xl border border-rose-500/20 bg-rose-500/10 px-6 py-16 text-rose-300">
              <AlertTriangle size={20} />
              <p className="text-sm font-medium">{error}</p>
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="py-20 text-center text-slate-500">
              <Receipt className="mx-auto mb-4 opacity-20" size={48} />
              <p>{search ? 'No invoices match your search.' : 'No issued invoices are available.'}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {filteredInvoices.map((invoice) => (
                <article
                  key={invoice.id}
                  className="group rounded-3xl border border-white/5 bg-white/5 p-5 transition-all hover:border-indigo-500/30 hover:bg-white/10 sm:p-6"
                >
                  <div className="mb-5 flex items-start justify-between gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-300 transition-transform group-hover:scale-105">
                      <Receipt size={24} />
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${statusClass[invoice.status] || statusClass.issued}`}>
                      {invoice.status}
                    </span>
                  </div>

                  <h3 className="mb-3 break-words text-lg font-bold text-white">{invoice.invoiceNumber}</h3>
                  <div className="mb-3 flex items-start gap-2 text-sm text-slate-400">
                    <MapPin className="mt-0.5 shrink-0 text-indigo-400" size={16} />
                    <span>{invoice.site?.name || 'Linked site'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500">
                    <CalendarDays size={14} />
                    <span>{formatDate(invoice.billingStartDate)} - {formatDate(invoice.billingEndDate)}</span>
                  </div>

                  <div className="mt-5 grid grid-cols-3 gap-3 rounded-2xl border border-white/5 bg-black/10 p-3 text-center">
                    <div>
                      <div className="text-lg font-black text-white">{invoice.totalHours}</div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Hours</div>
                    </div>
                    <div>
                      <div className="text-lg font-black text-white">{formatMoney(invoice.subtotal)}</div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Subtotal</div>
                    </div>
                    <div>
                      <div className="text-lg font-black text-white">{formatMoney(invoice.totalAmount)}</div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Total</div>
                    </div>
                  </div>

                  <div className="mt-6 flex flex-col gap-3 border-t border-white/5 pt-4 sm:flex-row">
                    <Link
                      href={`/client/invoices/${invoice.id}`}
                      className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-2xl bg-white/5 px-4 py-2 text-sm font-bold text-slate-200 transition hover:bg-indigo-600 hover:text-white"
                    >
                      View Details <ArrowRight size={16} />
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleDownload(invoice)}
                      disabled={downloadingId === invoice.id}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-white/5 px-4 py-2 text-sm font-bold text-slate-200 transition hover:bg-white/10 disabled:opacity-60"
                    >
                      {downloadingId === invoice.id ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />}
                      PDF
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </ClientLayout>
  );
}
