'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';
import { getApiErrorMessage } from '@/lib/api-error';
import {
  approveTimesheet,
  getTimesheets,
  rejectTimesheet,
  Timesheet,
  TimesheetStatus,
} from '@/lib/timesheets';
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Loader2,
  ShieldCheck,
  SlidersHorizontal,
  XCircle,
} from 'lucide-react';

type StatusFilter = TimesheetStatus | 'all';

const statusClass: Record<string, string> = {
  pending: 'border-amber-400/20 bg-amber-400/10 text-amber-300',
  approved: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300',
  rejected: 'border-rose-400/20 bg-rose-400/10 text-rose-300',
  corrected: 'border-sky-400/20 bg-sky-400/10 text-sky-300',
};

const statusFilters: { value: StatusFilter; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'corrected', label: 'Corrected' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'all', label: 'All' },
];

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

function formatHours(value: number) {
  return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(value)}h`;
}

export default function TimesheetsPage() {
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState('');
  const [error, setError] = useState('');

  const pendingCount = useMemo(
    () => timesheets.filter((timesheet) => timesheet.status === 'pending').length,
    [timesheets],
  );

  const fetchTimesheets = async (filter: StatusFilter) => {
    setLoading(true);
    try {
      const data = await getTimesheets(filter === 'all' ? undefined : filter);
      setTimesheets(Array.isArray(data) ? data : []);
      setError('');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not load timesheets.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTimesheets(statusFilter);
  }, [statusFilter]);

  const updateTimesheet = (updated: Timesheet) => {
    setTimesheets((current) => {
      const next = current.map((timesheet) => (timesheet.id === updated.id ? updated : timesheet));
      if (statusFilter !== 'all' && updated.status !== statusFilter) {
        return next.filter((timesheet) => timesheet.id !== updated.id);
      }
      return next;
    });
  };

  const handleApprove = async (id: string) => {
    setActionId(id);
    setError('');

    try {
      updateTimesheet(await approveTimesheet(id));
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not approve timesheet.'));
    } finally {
      setActionId('');
    }
  };

  const handleReject = async (id: string) => {
    const reason = window.prompt('Rejection reason');
    if (!reason?.trim()) return;

    setActionId(id);
    setError('');

    try {
      updateTimesheet(await rejectTimesheet(id, reason.trim()));
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not reject timesheet.'));
    } finally {
      setActionId('');
    }
  };

  return (
    <DashboardLayout>
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="flex items-center gap-3 text-2xl font-bold sm:text-3xl">
            <ClipboardCheck className="text-indigo-300" size={28} />
            Timesheets
          </h2>
          <p className="mt-2 text-muted-foreground">Approve worked hours before invoice generation.</p>
        </div>
        <div className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm font-bold text-slate-200">
          <Clock3 size={16} className="text-amber-300" />
          {pendingCount} pending
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {statusFilters.map((filter) => {
          const active = statusFilter === filter.value;
          return (
            <button
              key={filter.value}
              type="button"
              onClick={() => setStatusFilter(filter.value)}
              className={`inline-flex min-h-10 items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition ${
                active
                  ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                  : 'border border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/10'
              }`}
            >
              <SlidersHorizontal size={15} />
              {filter.label}
            </button>
          );
        })}
      </div>

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
            Loading timesheets...
          </div>
        ) : timesheets.length === 0 ? (
          <div className="py-20 text-center text-muted-foreground">No timesheets found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="responsive-table w-full text-left">
              <thead>
                <tr className="border-b border-white/5 text-sm uppercase tracking-wider text-muted-foreground">
                  <th className="px-6 py-4 font-semibold">Guard</th>
                  <th className="px-6 py-4 font-semibold">Site/Client</th>
                  <th className="px-6 py-4 font-semibold">Worked</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  <th className="px-6 py-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {timesheets.map((timesheet) => (
                  <tr key={timesheet.id} className="transition hover:bg-white/5">
                    <td className="px-6 py-4" data-label="Guard">
                      <div className="flex items-center gap-2 font-semibold text-white">
                        <ShieldCheck size={16} className="text-emerald-300" />
                        {timesheet.guard?.name || 'Guard'}
                      </div>
                      <div className="mt-1 text-sm text-slate-500">{timesheet.guard?.email || timesheet.guard?.phone || 'No contact listed'}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-300" data-label="Site/Client">
                      <div>{timesheet.site?.name || 'Site'}</div>
                      <div className="mt-1 text-slate-500">{timesheet.client?.companyName || timesheet.client?.name || 'Unlinked client'}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-300" data-label="Worked">
                      <div className="font-bold text-white">{formatHours(timesheet.totalHours)}</div>
                      <div className="mt-1 flex items-center gap-2 text-slate-500">
                        <CalendarClock size={14} className="text-indigo-300" />
                        {formatDateTime(timesheet.checkInTime)}
                      </div>
                    </td>
                    <td className="px-6 py-4" data-label="Status">
                      <span className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-widest ${statusClass[timesheet.status] || statusClass.pending}`}>
                        {timesheet.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right" data-label="Actions">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Link
                          href={`/timesheets/${timesheet.id}`}
                          className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-xs font-bold text-slate-200 transition hover:bg-white/10"
                        >
                          View <ArrowRight size={14} />
                        </Link>
                        {['pending', 'corrected'].includes(timesheet.status) && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleApprove(timesheet.id)}
                              disabled={actionId === timesheet.id}
                              className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-emerald-500 px-3 py-2 text-xs font-bold text-white transition hover:bg-emerald-400 disabled:opacity-60"
                            >
                              {actionId === timesheet.id ? <Loader2 className="animate-spin" size={14} /> : <CheckCircle2 size={14} />}
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => handleReject(timesheet.id)}
                              disabled={actionId === timesheet.id}
                              className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-rose-500 px-3 py-2 text-xs font-bold text-white transition hover:bg-rose-400 disabled:opacity-60"
                            >
                              <XCircle size={14} />
                              Reject
                            </button>
                          </>
                        )}
                      </div>
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
