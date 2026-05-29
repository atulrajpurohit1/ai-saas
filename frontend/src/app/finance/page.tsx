'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';
import FinanceFiltersBar from '@/components/FinanceFilters';
import api from '@/lib/api';
import { getApiErrorMessage } from '@/lib/api-error';
import { downloadBlobFile } from '@/lib/csv';
import {
  exportFinanceInvoices,
  FinanceClient,
  FinanceDashboardSummary,
  FinanceFilters,
  getFinanceDashboard,
  invoiceStatuses,
} from '@/lib/finance';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  DollarSign,
  Download,
  FileWarning,
  Loader2,
  Receipt,
} from 'lucide-react';

const emptySummary: FinanceDashboardSummary = {
  totalIssuedAmount: 0,
  totalPaidAmount: 0,
  outstandingAmount: 0,
  disputedAmount: 0,
  invoiceCountByStatus: {
    draft: 0,
    issued: 0,
    disputed: 0,
    resolved: 0,
    paid: 0,
    cancelled: 0,
  },
};

const statusClass: Record<string, string> = {
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

export default function FinancePage() {
  const [summary, setSummary] = useState<FinanceDashboardSummary>(emptySummary);
  const [clients, setClients] = useState<FinanceClient[]>([]);
  const [filters, setFilters] = useState<FinanceFilters>({});
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');

  const cards = useMemo(
    () => [
      { label: 'Total issued', value: formatMoney(summary.totalIssuedAmount), icon: Receipt, tone: 'text-sky-300' },
      { label: 'Total paid', value: formatMoney(summary.totalPaidAmount), icon: CheckCircle2, tone: 'text-emerald-300' },
      { label: 'Outstanding', value: formatMoney(summary.outstandingAmount), icon: Clock, tone: 'text-amber-300' },
      { label: 'Disputed', value: formatMoney(summary.disputedAmount), icon: FileWarning, tone: 'text-orange-300' },
    ],
    [summary],
  );

  const fetchData = async (nextFilters = filters) => {
    setLoading(true);
    try {
      const [summaryData, clientsRes] = await Promise.all([
        getFinanceDashboard(nextFilters),
        api.get<FinanceClient[]>('clients'),
      ]);
      setSummary(summaryData);
      setClients(Array.isArray(clientsRes.data) ? clientsRes.data : []);
      setError('');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not load finance dashboard.'));
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

  const handleExport = async () => {
    setExporting(true);
    setError('');

    try {
      const blob = await exportFinanceInvoices(filters);
      downloadBlobFile(`finance-invoices-${new Date().toISOString().slice(0, 10)}.csv`, blob);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not export invoice CSV.'));
    } finally {
      setExporting(false);
    }
  };

  return (
    <DashboardLayout allowedRoles={['admin', 'finance']}>
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="flex items-center gap-3 text-2xl font-bold sm:text-3xl">
            <DollarSign className="text-indigo-300" size={28} />
            Finance
          </h2>
          <p className="mt-2 text-muted-foreground">Invoice accounting totals and finance exports.</p>
        </div>
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-emerald-400 disabled:opacity-60"
        >
          {exporting ? <Loader2 className="animate-spin" size={17} /> : <Download size={17} />}
          Export CSV
        </button>
      </div>

      <FinanceFiltersBar
        filters={filters}
        clients={clients}
        statusOptions={invoiceStatuses}
        statusLabel="Invoice status"
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

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
              <div className="mb-5 flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-slate-400">{card.label}</span>
                <Icon className={card.tone} size={22} />
              </div>
              <div className="text-2xl font-black text-white sm:text-3xl">
                {loading ? <Loader2 className="animate-spin text-indigo-300" size={24} /> : card.value}
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="overflow-hidden rounded-3xl border border-white/5 bg-white/[0.04]">
          <div className="border-b border-white/5 px-6 py-4">
            <h3 className="font-bold text-white">Invoice Count By Status</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="responsive-table w-full text-left">
              <thead>
                <tr className="border-b border-white/5 text-sm uppercase tracking-wider text-muted-foreground">
                  <th className="px-6 py-4 font-semibold">Status</th>
                  <th className="px-6 py-4 font-semibold">Invoices</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {invoiceStatuses.map((status) => (
                  <tr key={status} className="transition hover:bg-white/5">
                    <td className="px-6 py-4" data-label="Status">
                      <span className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-widest ${statusClass[status]}`}>
                        {status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-white" data-label="Invoices">
                      {summary.invoiceCountByStatus[status] || 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-3">
          {[
            { href: '/finance/reports/payments', label: 'Payment report', icon: CheckCircle2 },
            { href: '/finance/reports/outstanding', label: 'Outstanding invoices', icon: Clock },
            { href: '/finance/reports/disputes', label: 'Dispute report', icon: FileWarning },
          ].map((report) => {
            const Icon = report.icon;
            return (
              <Link
                key={report.href}
                href={report.href}
                className="flex min-h-16 items-center justify-between gap-4 rounded-3xl border border-white/10 bg-white/[0.04] px-5 py-4 text-white transition hover:bg-white/[0.07]"
              >
                <span className="flex items-center gap-3 font-bold">
                  <Icon className="text-indigo-300" size={20} />
                  {report.label}
                </span>
                <ArrowRight size={17} className="text-slate-400" />
              </Link>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
}
