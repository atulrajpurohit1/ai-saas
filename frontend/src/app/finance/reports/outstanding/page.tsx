'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';
import FinanceFiltersBar from '@/components/FinanceFilters';
import api from '@/lib/api';
import { getApiErrorMessage } from '@/lib/api-error';
import { buildCsv, downloadTextFile } from '@/lib/csv';
import { FinanceClient, FinanceFilters, getOutstandingReport, OutstandingReportRow } from '@/lib/finance';
import { AlertTriangle, ArrowLeft, Clock, Download, Loader2, Receipt } from 'lucide-react';

const statusClass: Record<string, string> = {
  issued: 'border-sky-400/20 bg-sky-400/10 text-sky-300',
  resolved: 'border-violet-400/20 bg-violet-400/10 text-violet-300',
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

function clientName(row: OutstandingReportRow) {
  return row.client?.companyName || row.client?.name || 'Client';
}

export default function OutstandingReportPage() {
  const [rows, setRows] = useState<OutstandingReportRow[]>([]);
  const [clients, setClients] = useState<FinanceClient[]>([]);
  const [filters, setFilters] = useState<FinanceFilters>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = async (nextFilters = filters) => {
    setLoading(true);
    try {
      const [reportData, clientsRes] = await Promise.all([
        getOutstandingReport(nextFilters),
        api.get<FinanceClient[]>('clients'),
      ]);
      setRows(Array.isArray(reportData) ? reportData : []);
      setClients(Array.isArray(clientsRes.data) ? clientsRes.data : []);
      setError('');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not load outstanding invoices.'));
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
      ['invoice_number', 'client', 'site', 'status', 'amount', 'issued_at', 'due_date', 'is_overdue', 'days_overdue'],
      rows.map((row) => [
        row.invoiceNumber,
        clientName(row),
        row.site?.name || '',
        row.status,
        row.amount,
        row.issuedAt || '',
        row.dueDate || '',
        row.isOverdue,
        row.daysOverdue,
      ]),
    );
    downloadTextFile(`outstanding-invoices-${new Date().toISOString().slice(0, 10)}.csv`, csv);
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
            <Clock className="text-amber-300" size={28} />
            Outstanding Invoices
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
            Loading outstanding invoices...
          </div>
        ) : rows.length === 0 ? (
          <div className="py-20 text-center text-muted-foreground">No outstanding invoices found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="responsive-table w-full text-left">
              <thead>
                <tr className="border-b border-white/5 text-sm uppercase tracking-wider text-muted-foreground">
                  <th className="px-6 py-4 font-semibold">Invoice</th>
                  <th className="px-6 py-4 font-semibold">Client</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  <th className="px-6 py-4 font-semibold">Issued</th>
                  <th className="px-6 py-4 font-semibold">Due</th>
                  <th className="px-6 py-4 font-semibold text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {rows.map((row) => (
                  <tr key={row.invoiceId} className="transition hover:bg-white/5">
                    <td className="px-6 py-4" data-label="Invoice">
                      <div className="flex items-center gap-2 font-bold text-white">
                        <Receipt size={15} className="text-indigo-300" />
                        {row.invoiceNumber}
                      </div>
                      <div className="mt-1 text-sm text-slate-500">{row.site?.name || 'Site'}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-300" data-label="Client">
                      {clientName(row)}
                    </td>
                    <td className="px-6 py-4" data-label="Status">
                      <span className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-widest ${statusClass[row.status] || statusClass.issued}`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-300" data-label="Issued">
                      {formatDate(row.issuedAt)}
                    </td>
                    <td className="px-6 py-4 text-sm" data-label="Due">
                      <div className={row.isOverdue ? 'font-bold text-rose-300' : 'text-slate-300'}>
                        {formatDate(row.dueDate)}
                      </div>
                      {row.isOverdue && (
                        <div className="mt-1 text-xs font-semibold text-rose-300">
                          {row.daysOverdue} days overdue
                        </div>
                      )}
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
