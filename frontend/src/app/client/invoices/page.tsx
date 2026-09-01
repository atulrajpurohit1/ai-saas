'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import ClientLayout from '@/components/ClientLayout';
import api from '@/lib/api';
import { getApiErrorMessage } from '@/lib/api-error';
import { getClientInvoices, Invoice } from '@/lib/invoices';
import { ArrowRight, CalendarDays, Download, Loader2, MapPin, Receipt, Search } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';
import LoadingState from '@/components/LoadingState';
import ErrorState from '@/components/ErrorState';
import StatusBadge from '@/components/StatusBadge';

function formatDate(value: string) {
  return new Date(value).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatMoney(value: number) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(value);
}

export default function ClientInvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState('');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getClientInvoices();
      setInvoices(Array.isArray(data) ? data : []);
      setError('');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not load invoices.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const filteredInvoices = useMemo(() => {
    const normalized = search.toLowerCase();
    return invoices.filter((invoice) => (invoice.invoiceNumber || '').toLowerCase().includes(normalized));
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
      <PageHeader title="Invoices" description="Issued billing invoices for your linked sites." />

      <div className="surface-card overflow-hidden">
        <div className="border-b border-border bg-muted/50 p-4 sm:p-5">
          <div className="relative w-full sm:max-w-md">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <input
              type="text"
              placeholder="Search invoices…"
              className="w-full rounded-[var(--radius)] border border-border bg-card py-2.5 pl-10 pr-4 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary/40 focus:ring-2 focus:ring-ring/50"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>

        <div className="p-3 sm:p-4">
          {loading ? (
            <LoadingState label="Loading invoices…" />
          ) : error ? (
            <ErrorState message={error} onRetry={fetchInvoices} />
          ) : filteredInvoices.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title={search ? 'No matching invoices' : 'No issued invoices'}
              description={
                search ? 'Try a different search term.' : 'Issued invoices for your sites will appear here.'
              }
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {filteredInvoices.map((invoice) => (
                <article
                  key={invoice.id}
                  className="group flex flex-col rounded-[var(--radius)] border border-border bg-card p-5 transition hover:border-primary/30 hover:shadow-md"
                >
                  <div className="mb-4 flex items-start justify-between gap-4">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius)] bg-primary/10 text-primary">
                      <Receipt size={22} />
                    </span>
                    <StatusBadge status={invoice.status} />
                  </div>

                  <h3 className="mb-3 break-words text-base font-bold text-foreground">{invoice.invoiceNumber}</h3>
                  <div className="mb-2 flex items-start gap-2 text-sm text-muted-foreground">
                    <MapPin className="mt-0.5 shrink-0 text-primary" size={16} />
                    <span>{invoice.site?.name || 'Linked site'}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-eyebrow">
                    <CalendarDays size={13} />
                    {formatDate(invoice.billingStartDate)} – {formatDate(invoice.billingEndDate)}
                  </div>

                  <div className="surface-muted mt-4 grid grid-cols-3 gap-3 p-3 text-center">
                    {[
                      ['Hours', invoice.totalHours],
                      ['Subtotal', formatMoney(invoice.subtotal)],
                      ['Total', formatMoney(invoice.totalAmount)],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <div className="text-sm font-extrabold text-foreground">{value}</div>
                        <div className="text-eyebrow">{label}</div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-5 flex flex-col gap-2 border-t border-border pt-4 sm:flex-row">
                    <Link
                      href={`/client/invoices/${invoice.id}`}
                      className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-[var(--radius-sm)] bg-muted px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-primary hover:text-primary-foreground"
                    >
                      View Details <ArrowRight size={16} />
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleDownload(invoice)}
                      disabled={downloadingId === invoice.id}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-sm)] border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-muted disabled:opacity-60"
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
