'use client';

import React from 'react';
import { CalendarDays, Filter, RotateCcw } from 'lucide-react';
import { FinanceClient, FinanceFilters } from '@/lib/finance';

interface FinanceFiltersProps {
  filters: FinanceFilters;
  clients: FinanceClient[];
  statusOptions?: string[];
  statusLabel?: string;
  onChange: (filters: FinanceFilters) => void;
  onApply: () => void;
  onReset: () => void;
}

export default function FinanceFiltersBar({
  filters,
  clients,
  statusOptions = [],
  statusLabel = 'Status',
  onChange,
  onApply,
  onReset,
}: FinanceFiltersProps) {
  return (
    <div className="mb-6 grid gap-3 rounded-3xl border border-white/10 bg-white/[0.04] p-4 md:grid-cols-2 xl:grid-cols-[150px_150px_1fr_180px_auto_auto]">
      <label className="space-y-2">
        <span className="flex items-center gap-2 text-sm font-semibold text-slate-300">
          <CalendarDays size={15} className="text-indigo-300" />
          Start
        </span>
        <input
          type="date"
          value={filters.start_date || ''}
          onChange={(event) => onChange({ ...filters, start_date: event.target.value })}
          className="min-h-11 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-white outline-none focus:ring-2 focus:ring-indigo-500/50"
        />
      </label>

      <label className="space-y-2">
        <span className="flex items-center gap-2 text-sm font-semibold text-slate-300">
          <CalendarDays size={15} className="text-indigo-300" />
          End
        </span>
        <input
          type="date"
          value={filters.end_date || ''}
          onChange={(event) => onChange({ ...filters, end_date: event.target.value })}
          className="min-h-11 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-white outline-none focus:ring-2 focus:ring-indigo-500/50"
        />
      </label>

      <label className="space-y-2">
        <span className="text-sm font-semibold text-slate-300">Client</span>
        <select
          value={filters.client_id || ''}
          onChange={(event) => onChange({ ...filters, client_id: event.target.value })}
          className="min-h-11 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-white outline-none focus:ring-2 focus:ring-indigo-500/50"
        >
          <option value="" className="bg-[#0e0e1a] text-white">All clients</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id} className="bg-[#0e0e1a] text-white">
              {client.companyName || client.name}
            </option>
          ))}
        </select>
      </label>

      <label className="space-y-2">
        <span className="text-sm font-semibold text-slate-300">{statusLabel}</span>
        <select
          value={filters.status || ''}
          onChange={(event) => onChange({ ...filters, status: event.target.value })}
          disabled={statusOptions.length === 0}
          className="min-h-11 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-white outline-none focus:ring-2 focus:ring-indigo-500/50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="" className="bg-[#0e0e1a] text-white">All</option>
          {statusOptions.map((status) => (
            <option key={status} value={status} className="bg-[#0e0e1a] text-white">
              {status.replace('_', ' ')}
            </option>
          ))}
        </select>
      </label>

      <button
        type="button"
        onClick={onApply}
        className="inline-flex min-h-11 items-center justify-center gap-2 self-end rounded-xl bg-indigo-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-indigo-400"
      >
        <Filter size={16} />
        Apply
      </button>

      <button
        type="button"
        onClick={onReset}
        className="inline-flex min-h-11 items-center justify-center gap-2 self-end rounded-xl bg-white/5 px-4 py-3 text-sm font-bold text-slate-200 transition hover:bg-white/10"
      >
        <RotateCcw size={16} />
        Reset
      </button>
    </div>
  );
}
