'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { getApiErrorMessage } from '@/lib/api-error';
import {
  approveTimesheet,
  correctTimesheet,
  getTimesheet,
  rejectTimesheet,
  Timesheet,
} from '@/lib/timesheets';
import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Loader2,
  MapPin,
  PencilLine,
  ShieldCheck,
  UserRound,
  XCircle,
} from 'lucide-react';

const statusClass: Record<string, string> = {
  pending: 'border-amber-400/20 bg-amber-400/10 text-amber-300',
  approved: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300',
  rejected: 'border-rose-400/20 bg-rose-400/10 text-rose-300',
  corrected: 'border-sky-400/20 bg-sky-400/10 text-sky-300',
};

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

function toDateTimeInputValue(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function toIsoFromDateTimeInput(value: string) {
  if (!value) return undefined;
  return new Date(value).toISOString();
}

function formatHours(value: number) {
  return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(value)}h`;
}

export default function TimesheetDetailPage() {
  const params = useParams<{ id: string }>();
  const timesheetId = Array.isArray(params.id) ? params.id[0] : params.id;
  const [timesheet, setTimesheet] = useState<Timesheet | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [correction, setCorrection] = useState({
    total_hours: '',
    check_in_time: '',
    check_out_time: '',
    correction_reason: '',
  });

  useEffect(() => {
    const fetchTimesheet = async () => {
      if (!timesheetId) return;

      setLoading(true);
      try {
        const data = await getTimesheet(timesheetId);
        setTimesheet(data);
        setCorrection({
          total_hours: String(data.totalHours),
          check_in_time: toDateTimeInputValue(data.checkInTime),
          check_out_time: toDateTimeInputValue(data.checkOutTime),
          correction_reason: '',
        });
        setRejectionReason(data.rejectionReason || '');
        setError('');
      } catch (err) {
        setError(getApiErrorMessage(err, 'Could not load this timesheet.'));
      } finally {
        setLoading(false);
      }
    };

    fetchTimesheet();
  }, [timesheetId]);

  const handleApprove = async () => {
    if (!timesheet) return;

    setWorking(true);
    setError('');

    try {
      setTimesheet(await approveTimesheet(timesheet.id));
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not approve timesheet.'));
    } finally {
      setWorking(false);
    }
  };

  const handleReject = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!timesheet || !rejectionReason.trim()) return;

    setWorking(true);
    setError('');

    try {
      setTimesheet(await rejectTimesheet(timesheet.id, rejectionReason.trim()));
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not reject timesheet.'));
    } finally {
      setWorking(false);
    }
  };

  const handleCorrect = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!timesheet) return;

    setWorking(true);
    setError('');

    try {
      const updated = await correctTimesheet(timesheet.id, {
        total_hours: Number(correction.total_hours),
        check_in_time: toIsoFromDateTimeInput(correction.check_in_time),
        check_out_time: toIsoFromDateTimeInput(correction.check_out_time),
        correction_reason: correction.correction_reason.trim() || undefined,
      });
      setTimesheet(updated);
      setCorrection((current) => ({
        ...current,
        total_hours: String(updated.totalHours),
        correction_reason: '',
      }));
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not correct timesheet.'));
    } finally {
      setWorking(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="mb-6">
        <Link href="/timesheets" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-400 transition hover:text-white">
          <ArrowLeft size={16} />
          Back to timesheets
        </Link>
      </div>

      {loading ? (
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] py-24 text-center text-slate-500">
          <Loader2 className="mx-auto mb-3 animate-spin text-indigo-300" size={28} />
          Loading timesheet...
        </div>
      ) : error || !timesheet ? (
        <div className="rounded-3xl border border-rose-500/20 bg-rose-500/10 p-6 text-rose-300">
          <div className="flex items-center gap-3">
            <AlertTriangle size={20} />
            {error || 'Timesheet not found.'}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 sm:p-8">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <span className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-widest ${statusClass[timesheet.status] || statusClass.pending}`}>
                {timesheet.status}
              </span>
              <span className="rounded-full border border-indigo-400/20 bg-indigo-400/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-indigo-200">
                {formatHours(timesheet.totalHours)}
              </span>
            </div>

            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h1 className="flex items-start gap-3 break-words text-2xl font-extrabold text-white sm:text-3xl">
                  <ShieldCheck className="mt-0.5 shrink-0 text-emerald-300" size={30} />
                  {timesheet.guard?.name || 'Guard'}
                </h1>
                <p className="mt-3 text-slate-400">
                  {timesheet.site?.name || 'Site'} - {timesheet.client?.companyName || timesheet.client?.name || 'Unlinked client'}
                </p>
              </div>

              {['pending', 'corrected'].includes(timesheet.status) && (
                <button
                  type="button"
                  onClick={handleApprove}
                  disabled={working}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-emerald-400 disabled:opacity-60"
                >
                  {working ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
                  Approve
                </button>
              )}
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
              <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500">
                <Clock3 size={14} />
                Hours
              </div>
              <div className="text-3xl font-black text-white">{formatHours(timesheet.totalHours)}</div>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
              <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500">
                <CalendarClock size={14} />
                Check In
              </div>
              <div className="text-sm font-bold text-white">{formatDateTime(timesheet.checkInTime)}</div>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
              <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500">
                <CalendarClock size={14} />
                Check Out
              </div>
              <div className="text-sm font-bold text-white">{formatDateTime(timesheet.checkOutTime)}</div>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
              <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500">
                <UserRound size={14} />
                Approved
              </div>
              <div className="text-sm font-bold text-white">{formatDateTime(timesheet.approvedAt)}</div>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
              <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500">
                <MapPin size={14} />
                Site
              </div>
              <div className="text-lg font-bold text-white">{timesheet.site?.name || 'Site'}</div>
              <div className="mt-1 text-sm text-slate-400">{timesheet.site?.address || 'No address listed'}</div>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
              <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500">
                <UserRound size={14} />
                Client
              </div>
              <div className="text-lg font-bold text-white">{timesheet.client?.companyName || timesheet.client?.name || 'Unlinked client'}</div>
              <div className="mt-1 text-sm text-slate-400">{timesheet.client?.email || 'No client email listed'}</div>
            </div>
          </section>

          {timesheet.rejectionReason && (
            <div className="rounded-3xl border border-rose-500/20 bg-rose-500/10 p-5 text-sm text-rose-200">
              <div className="mb-1 font-bold text-rose-100">Rejection Reason</div>
              {timesheet.rejectionReason}
            </div>
          )}

          <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
            <form onSubmit={handleCorrect} className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 sm:p-6">
              <h2 className="mb-4 flex items-center gap-2 text-xl font-bold text-white">
                <PencilLine size={20} className="text-sky-300" />
                Correct Hours
              </h2>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-300">Hours</label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    className="min-h-11 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-white outline-none focus:ring-2 focus:ring-indigo-500/50"
                    value={correction.total_hours}
                    onChange={(event) => setCorrection({ ...correction, total_hours: event.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-300">Check In</label>
                  <input
                    type="datetime-local"
                    className="min-h-11 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-white outline-none focus:ring-2 focus:ring-indigo-500/50"
                    value={correction.check_in_time}
                    onChange={(event) => setCorrection({ ...correction, check_in_time: event.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-300">Check Out</label>
                  <input
                    type="datetime-local"
                    className="min-h-11 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-white outline-none focus:ring-2 focus:ring-indigo-500/50"
                    value={correction.check_out_time}
                    onChange={(event) => setCorrection({ ...correction, check_out_time: event.target.value })}
                  />
                </div>
              </div>
              <div className="mt-4 space-y-2">
                <label className="text-sm font-semibold text-slate-300">Reason</label>
                <textarea
                  className="min-h-28 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:ring-2 focus:ring-indigo-500/50"
                  value={correction.correction_reason}
                  onChange={(event) => setCorrection({ ...correction, correction_reason: event.target.value })}
                />
              </div>
              <button
                type="submit"
                disabled={working}
                className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-sky-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-sky-400 disabled:opacity-60"
              >
                {working ? <Loader2 className="animate-spin" size={16} /> : <PencilLine size={16} />}
                Save Correction
              </button>
            </form>

            <form onSubmit={handleReject} className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 sm:p-6">
              <h2 className="mb-4 flex items-center gap-2 text-xl font-bold text-white">
                <XCircle size={20} className="text-rose-300" />
                Reject
              </h2>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-300">Reason</label>
                <textarea
                  className="min-h-36 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:ring-2 focus:ring-indigo-500/50"
                  value={rejectionReason}
                  onChange={(event) => setRejectionReason(event.target.value)}
                  required
                />
              </div>
              <button
                type="submit"
                disabled={working || !rejectionReason.trim() || !['pending', 'corrected'].includes(timesheet.status)}
                className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-rose-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-rose-400 disabled:opacity-60"
              >
                {working ? <Loader2 className="animate-spin" size={16} /> : <XCircle size={16} />}
                Reject Timesheet
              </button>
            </form>
          </section>
        </div>
      )}
    </DashboardLayout>
  );
}
