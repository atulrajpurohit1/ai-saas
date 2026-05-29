'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';
import { getApiErrorMessage } from '@/lib/api-error';
import { AdminInvoiceDispute, getInvoiceDisputes } from '@/lib/invoice-disputes';
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  FileWarning,
  Loader2,
  Receipt,
  Search,
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

type StatusFilter = 'active' | 'all' | 'open' | 'under_review' | 'resolved' | 'rejected';

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

export default function InvoiceDisputesPage() {
  const [disputes, setDisputes] = useState<AdminInvoiceDispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');

  useEffect(() => {
    const fetchDisputes = async () => {
      try {
        const data = await getInvoiceDisputes();
        setDisputes(Array.isArray(data) ? data : []);
        setError('');
      } catch (err) {
        setError(getApiErrorMessage(err, 'Could not load invoice disputes.'));
      } finally {
        setLoading(false);
      }
    };

    fetchDisputes();
  }, []);

  const filteredDisputes = useMemo(() => {
    const normalized = search.toLowerCase();
    return disputes.filter((dispute) => {
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active'
          ? dispute.status === 'open' || dispute.status === 'under_review'
          : dispute.status === statusFilter);
      const matchesSearch = [
        dispute.reason,
        dispute.description,
        dispute.adminResponse || '',
        dispute.invoice?.invoiceNumber || '',
        dispute.client?.companyName || dispute.client?.name || '',
        dispute.invoice?.site?.name || '',
      ].some((value) => value.toLowerCase().includes(normalized));

      return matchesStatus && matchesSearch;
    });
  }, [disputes, search, statusFilter]);

  return (
    <DashboardLayout>
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="flex items-center gap-3 text-2xl font-bold sm:text-3xl">
            <FileWarning className="text-indigo-300" size={28} />
            Invoice Disputes
          </h2>
          <p className="mt-2 text-muted-foreground">Client invoice disputes grouped by current review status.</p>
        </div>
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="min-h-11 w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-12 pr-4 text-white outline-none focus:ring-2 focus:ring-indigo-500/50"
            placeholder="Search disputes..."
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {(['active', 'all', 'open', 'under_review', 'resolved', 'rejected'] as StatusFilter[]).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={`min-h-11 rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-widest transition ${
                statusFilter === status ? 'bg-indigo-500 text-white' : 'bg-white/5 text-slate-300 hover:bg-white/10'
              }`}
            >
              {status.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-white/5 bg-white/[0.04]">
        {loading ? (
          <div className="py-20 text-center text-muted-foreground">
            <Loader2 className="mx-auto mb-3 animate-spin text-indigo-300" size={26} />
            Loading disputes...
          </div>
        ) : error ? (
          <div className="p-8 text-center text-rose-300">
            <AlertTriangle className="mx-auto mb-3" size={28} />
            {error}
          </div>
        ) : filteredDisputes.length === 0 ? (
          <div className="py-20 text-center text-muted-foreground">No invoice disputes found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="responsive-table w-full text-left">
              <thead>
                <tr className="border-b border-white/5 text-sm uppercase tracking-wider text-muted-foreground">
                  <th className="px-6 py-4 font-semibold">Dispute</th>
                  <th className="px-6 py-4 font-semibold">Invoice</th>
                  <th className="px-6 py-4 font-semibold">Client</th>
                  <th className="px-6 py-4 font-semibold">Response</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  <th className="px-6 py-4 font-semibold text-right">Review</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredDisputes.map((dispute) => (
                  <tr key={dispute.id} className="transition hover:bg-white/5">
                    <td className="px-6 py-4" data-label="Dispute">
                      <div className="font-semibold text-white">{dispute.reason}</div>
                      <div className="mt-1 max-w-md truncate text-sm text-slate-400">{dispute.description}</div>
                      <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                        <CalendarDays size={13} className="text-indigo-300" />
                        {formatDate(dispute.createdAt)}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-300" data-label="Invoice">
                      <div className="flex items-center gap-2 font-bold text-white">
                        <Receipt size={15} className="text-indigo-300" />
                        {dispute.invoice?.invoiceNumber || 'Invoice'}
                      </div>
                      <div className="mt-1 text-slate-500">{dispute.invoice ? formatMoney(dispute.invoice.totalAmount) : 'N/A'}</div>
                      <div className="mt-2">
                        <span className={`rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-widest ${invoiceStatusClass[dispute.invoice?.status || 'draft'] || invoiceStatusClass.draft}`}>
                          {dispute.invoice?.status || 'unknown'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-300" data-label="Client">
                      <div>{dispute.client?.companyName || dispute.client?.name || 'Client'}</div>
                      <div className="mt-1 text-slate-500">{dispute.invoice?.site?.name || dispute.client?.email || 'Linked site'}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-400" data-label="Response">
                      <div className="max-w-xs truncate">{dispute.adminResponse || 'No admin response yet'}</div>
                    </td>
                    <td className="px-6 py-4" data-label="Status">
                      <span className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-widest ${disputeStatusClass[dispute.status] || disputeStatusClass.open}`}>
                        {dispute.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right" data-label="Actions">
                      <Link
                        href={`/invoice-disputes/${dispute.id}`}
                        className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-xs font-bold text-slate-200 transition hover:bg-white/10"
                      >
                        View <ArrowRight size={14} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
