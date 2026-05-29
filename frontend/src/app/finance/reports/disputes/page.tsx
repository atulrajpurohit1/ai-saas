'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';
import FinanceFiltersBar from '@/components/FinanceFilters';
import api from '@/lib/api';
import { getApiErrorMessage } from '@/lib/api-error';
import { buildCsv, downloadTextFile } from '@/lib/csv';
import {
  DisputeReportRow,
  disputeStatuses,
  FinanceClient,
  FinanceFilters,
  getDisputeReport,
} from '@/lib/finance';
import { AlertTriangle, ArrowLeft, Download, FileWarning, Loader2, Receipt } from 'lucide-react';

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

function formatMoney(value: number) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
  }).format(value);
}

function formatDate(value: string | null) {
  if (!value) return 'N/A';
  return new Date(value).toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function clientName(row: DisputeReportRow) {
  return row.client?.companyName || row.client?.name || 'Client';
}

export default function DisputeReportPage() {
  const [rows, setRows] = useState<DisputeReportRow[]>([]);
  const [clients, setClients] = useState<FinanceClient[]>([]);
  const [filters, setFilters] = useState<FinanceFilters>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = async (nextFilters = filters) => {
    setLoading(true);
    try {
      const [reportData, clientsRes] = await Promise.all([
        getDisputeReport(nextFilters),
        api.get<FinanceClient[]>('clients'),
      ]);
      setRows(Array.isArray(reportData) ? reportData : []);
      setClients(Array.isArray(clientsRes.data) ? clientsRes.data : []);
      setError('');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not load dispute report.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData({});
  }, []);

  const handleReset = () => {
    setFilters({});
    fetchData({});
  };

  const handleExport = () => {
    const csv = buildCsv(
      ['invoice_number', 'client', 'site', 'amount', 'dispute_reason', 'dispute_status', 'invoice_status', 'created_at', 'resolved_at'],
      rows.map((row) => [
        row.invoiceNumber,
        clientName(row),
        row.site?.name || '',
        row.amount,
        row.disputeReason,
        row.status,
        row.invoiceStatus || '',
        row.createdAt,
        row.resolvedAt || '',
      ]),
    );
    downloadTextFile(`dispute-report-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  };

  return (
    <DashboardLayout allowedRoles={['admin', 'finance']}>
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Link href="/finance" className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-indigo-300 hover:text-indigo-200">
            <ArrowLeft size={16} />
            Finance
          </Link>
          <h2 className="flex items-center gap-3 text-2xl font-bold sm:text-3xl">
            <FileWarning className="text-orange-300" size={28} />
            Dispute Report
          </h2>
        </div>
        <button
          type="button"
          onClick={handleExport}
          disabled={rows.length === 0}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-emerald-400 disabled:opacity-60"
        >
          <Download size={17} />
          Export CSV
        </button>
      </div>

      <FinanceFiltersBar
        filters={filters}
        clients={clients}
        statusOptions={disputeStatuses}
        statusLabel="Dispute status"
        onChange={setFilters}
        onApply={() => fetchData(filters)}
        onReset={handleReset}
      />

      {error && (
        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-5 py-4 text-sm font-semibold text-rose-300">
          <AlertTriangle size={18} />
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-3xl border border-white/5 bg-white/[0.04]">
        {loading ? (
          <div className="py-20 text-center text-muted-foreground">
            <Loader2 className="mx-auto mb-3 animate-spin text-indigo-300" size={26} />
            Loading disputes...
          </div>
        ) : rows.length === 0 ? (
          <div className="py-20 text-center text-muted-foreground">No disputed invoices found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="responsive-table w-full text-left">
              <thead>
                <tr className="border-b border-white/5 text-sm uppercase tracking-wider text-muted-foreground">
                  <th className="px-6 py-4 font-semibold">Invoice</th>
                  <th className="px-6 py-4 font-semibold">Client</th>
                  <th className="px-6 py-4 font-semibold">Dispute</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  <th className="px-6 py-4 font-semibold">Created</th>
                  <th className="px-6 py-4 font-semibold text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {rows.map((row) => (
                  <tr key={row.disputeId} className="transition hover:bg-white/5">
                    <td className="px-6 py-4" data-label="Invoice">
                      <div className="flex items-center gap-2 font-bold text-white">
                        <Receipt size={15} className="text-indigo-300" />
                        {row.invoiceNumber}
                      </div>
                      <div className="mt-1 text-sm text-slate-500">{row.site?.name || 'Site'}</div>
                      {row.invoiceStatus && (
                        <div className="mt-2">
                          <span className={`rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-widest ${invoiceStatusClass[row.invoiceStatus] || invoiceStatusClass.draft}`}>
                            {row.invoiceStatus}
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-300" data-label="Client">
                      {clientName(row)}
                    </td>
                    <td className="px-6 py-4" data-label="Dispute">
                      <div className="font-semibold text-white">{row.disputeReason}</div>
                      <div className="mt-1 max-w-sm truncate text-sm text-slate-400">{row.description}</div>
                    </td>
                    <td className="px-6 py-4" data-label="Status">
                      <span className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-widest ${disputeStatusClass[row.status] || disputeStatusClass.open}`}>
                        {row.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-300" data-label="Created">
                      {formatDate(row.createdAt)}
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-bold text-white" data-label="Amount">
                      {formatMoney(row.amount)}
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
