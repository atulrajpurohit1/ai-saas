'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import GuardLayout from '@/components/GuardLayout';
import api from '@/lib/api';
import { getApiErrorMessage } from '@/lib/api-error';
import { createGuardIncident, IncidentSeverity } from '@/lib/incidents';
import { OfflineSync } from '@/lib/offline-sync';
import { AlertTriangle, ArrowLeft, CalendarDays, CheckCircle2, Clock, FileWarning, Loader2, LogIn, LogOut, MapPin, Navigation, Send, ShieldCheck, X } from 'lucide-react';

interface GuardShiftDetail {
  id: string;
  startTime: string;
  endTime: string;
  status: string;
  assignmentStatus: string;
  attendanceStatus: 'not_started' | 'checked_in' | 'completed';
  checkInTime?: string | null;
  checkOutTime?: string | null;
  site: {
    id: string;
    name: string;
    address: string;
    instructions?: string;
  };
  assignedGuard: {
    id: string;
    name: string;
    phone?: string;
    email?: string;
  };
}

export default function GuardShiftDetailPage() {
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const [shift, setShift] = useState<GuardShiftDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState<'check-in' | 'check-out' | null>(null);
  const [actionMessage, setActionMessage] = useState('');
  const [actionError, setActionError] = useState('');
  const [showIncidentModal, setShowIncidentModal] = useState(false);
  const [incidentLoading, setIncidentLoading] = useState(false);
  const [incidentMessage, setIncidentMessage] = useState('');
  const [incidentError, setIncidentError] = useState('');
  const [incidentForm, setIncidentForm] = useState({
    title: '',
    description: '',
    severity: 'medium' as IncidentSeverity,
    occurredAt: '',
    attachmentUrl: '',
  });

  const fetchShift = useCallback(async (showFullLoader = true) => {
    if (!id) {
      if (showFullLoader) {
        setLoading(false);
      }
      setError('Shift not found.');
      return;
    }

    if (showFullLoader) {
      setLoading(true);
    }

    try {
      const response = await api.get(`guard/shifts/${id}`);
      setShift(response.data);
      setError('');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not open this shift. It may not be assigned to you.'));
    } finally {
      if (showFullLoader) {
        setLoading(false);
      }
    }
  }, [id]);

  useEffect(() => {
    fetchShift();
  }, [fetchShift]);

  const formatTime = (value: string) => new Date(value).toLocaleString([], {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const formatAttendanceTime = (value?: string | null) => value ? formatTime(value) : 'Not recorded';

  const toDatetimeLocal = (value: Date) => {
    const offsetMs = value.getTimezoneOffset() * 60 * 1000;
    return new Date(value.getTime() - offsetMs).toISOString().slice(0, 16);
  };

  const getAttendanceLabel = (status: GuardShiftDetail['attendanceStatus']) => {
    if (status === 'checked_in') return 'Checked in';
    if (status === 'completed') return 'Completed';
    return 'Not started';
  };

  const handleAttendanceAction = async (action: 'check-in' | 'check-out') => {
    if (!id || actionLoading) return;

    setActionLoading(action);
    setActionMessage('');
    setActionError('');

    try {
      if (!navigator.onLine) {
        OfflineSync.enqueueAction(action === 'check-in' ? 'check_in' : 'check_out', { shiftId: id });
        setActionMessage(`Saved offline, will sync later. (${action === 'check-in' ? 'Check in' : 'Check out'})`);
        
        // Optimistic update
        setShift(prev => prev ? {
          ...prev,
          attendanceStatus: action === 'check-in' ? 'checked_in' : 'completed',
          checkInTime: action === 'check-in' ? new Date().toISOString() : prev.checkInTime,
          checkOutTime: action === 'check-out' ? new Date().toISOString() : prev.checkOutTime,
          status: action === 'check-in' ? 'in_progress' : 'completed',
        } : prev);
      } else {
        await api.post(`guard/shifts/${id}/${action}`);
        setActionMessage(action === 'check-in' ? 'Checked in successfully.' : 'Checked out successfully.');
        await fetchShift(false);
      }
    } catch (err) {
      setActionError(getApiErrorMessage(err, `Could not ${action.replace('-', ' ')}.`));
    } finally {
      setActionLoading(null);
    }
  };

  const openIncidentModal = () => {
    setIncidentForm({
      title: '',
      description: '',
      severity: 'medium',
      occurredAt: toDatetimeLocal(new Date()),
      attachmentUrl: '',
    });
    setIncidentError('');
    setIncidentMessage('');
    setShowIncidentModal(true);
  };

  const handleSubmitIncident = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!id || incidentLoading) return;

    setIncidentLoading(true);
    setIncidentError('');
    setIncidentMessage('');

    const dto = {
      title: incidentForm.title.trim(),
      description: incidentForm.description.trim(),
      severity: incidentForm.severity,
      occurred_at: new Date(incidentForm.occurredAt).toISOString(),
      attachment_url: incidentForm.attachmentUrl.trim() || undefined,
    };

    try {
      if (!navigator.onLine) {
        OfflineSync.enqueueAction('incident_create', { shiftId: id, dto });
        setIncidentMessage('Saved offline, will sync later. (Incident)');
        setShowIncidentModal(false);
      } else {
        await createGuardIncident(id, dto);
        setIncidentMessage('Incident submitted successfully.');
        setShowIncidentModal(false);
      }
    } catch (err) {
      setIncidentError(getApiErrorMessage(err, 'Could not submit incident.'));
    } finally {
      setIncidentLoading(false);
    }
  };

  return (
    <GuardLayout>
      <Link href="/guard/shifts" className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-slate-400 hover:text-white">
        <ArrowLeft size={16} />
        Back to shifts
      </Link>

      {loading ? (
        <div className="py-20 text-center text-slate-500">Opening shift...</div>
      ) : error ? (
        <div className="rounded-3xl border border-rose-500/20 bg-rose-500/10 p-5 text-rose-300">
          <div className="flex items-center gap-3">
            <AlertTriangle size={20} />
            <span className="text-sm font-medium">{error}</span>
          </div>
        </div>
      ) : shift ? (
        <div className="space-y-6">
          <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 sm:p-8">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-emerald-300">
                {shift.status}
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-bold uppercase tracking-widest text-slate-300">
                {shift.assignmentStatus}
              </span>
            </div>

            <h1 className="text-2xl font-extrabold text-white sm:text-3xl">{shift.site.name}</h1>
            <div className="mt-3 flex items-start gap-2 text-slate-400">
              <MapPin size={18} className="mt-0.5 shrink-0 text-emerald-300" />
              <span>{shift.site.address}</span>
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500">
                  <ShieldCheck size={14} />
                  Attendance
                </div>
                <div className="text-2xl font-extrabold text-white">{getAttendanceLabel(shift.attendanceStatus)}</div>
                <div className="mt-4 grid gap-2 text-sm text-slate-400 sm:grid-cols-2">
                  <div>Check in: <span className="text-slate-200">{formatAttendanceTime(shift.checkInTime)}</span></div>
                  <div>Check out: <span className="text-slate-200">{formatAttendanceTime(shift.checkOutTime)}</span></div>
                </div>
              </div>

              <div className="grid w-full gap-3 sm:w-auto sm:grid-cols-2 lg:flex lg:flex-wrap">
                {shift.attendanceStatus === 'not_started' && (
                  <button
                    type="button"
                    onClick={() => handleAttendanceAction('check-in')}
                    disabled={actionLoading !== null}
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {actionLoading === 'check-in' ? <Loader2 size={18} className="animate-spin" /> : <LogIn size={18} />}
                    Check In
                  </button>
                )}

                {shift.attendanceStatus === 'checked_in' && (
                  <>
                    <Link
                      href={`/guard/shifts/${id}/patrols`}
                      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-indigo-500 shadow-md shadow-indigo-600/20 animate-in fade-in zoom-in-95 duration-200"
                    >
                      <Navigation size={18} />
                      Perform Patrols
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleAttendanceAction('check-out')}
                      disabled={actionLoading !== null}
                      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-sky-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {actionLoading === 'check-out' ? <Loader2 size={18} className="animate-spin" /> : <LogOut size={18} />}
                      Check Out
                    </button>
                  </>
                )}

                {shift.attendanceStatus === 'completed' && (
                  <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-sm font-bold text-emerald-300">
                    <CheckCircle2 size={18} />
                    Completed
                  </span>
                )}

                <button
                  type="button"
                  onClick={openIncidentModal}
                  disabled={shift.attendanceStatus === 'not_started'}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 px-5 py-3 text-sm font-bold text-amber-200 transition hover:bg-amber-400/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <FileWarning size={18} />
                  Report Incident
                </button>
              </div>
            </div>

            {actionMessage && (
              <div className="mt-5 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm font-medium text-emerald-200">
                {actionMessage}
              </div>
            )}

            {actionError && (
              <div className="mt-5 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm font-medium text-rose-300">
                {actionError}
              </div>
            )}

            {incidentMessage && (
              <div className="mt-5 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm font-medium text-emerald-200">
                {incidentMessage}
              </div>
            )}

            {incidentError && (
              <div className="mt-5 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm font-medium text-rose-300">
                {incidentError}
              </div>
            )}
          </section>

          <section className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
              <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500">
                <CalendarDays size={14} />
                Start
              </div>
              <div className="text-lg font-bold text-white">{formatTime(shift.startTime)}</div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
              <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500">
                <Clock size={14} />
                End
              </div>
              <div className="text-lg font-bold text-white">{formatTime(shift.endTime)}</div>
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
            <h2 className="mb-3 text-lg font-bold text-white">Site Instructions</h2>
            <p className="whitespace-pre-wrap text-sm leading-6 text-slate-300">
              {shift.site.instructions || 'No special instructions have been added for this site.'}
            </p>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-white">
              <ShieldCheck className="text-emerald-300" size={18} />
              Assigned Guard
            </h2>
            <div className="text-sm text-slate-300">{shift.assignedGuard.name}</div>
            <div className="mt-1 text-sm text-slate-500">{shift.assignedGuard.phone || shift.assignedGuard.email || 'No contact listed'}</div>
          </section>
        </div>
      ) : null}

      {showIncidentModal && shift && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-3 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="max-h-[calc(100dvh-1.5rem)] w-full max-w-xl overflow-y-auto rounded-3xl border border-white/10 bg-[#0b1718] p-5 shadow-2xl sm:max-h-[calc(100dvh-2rem)] sm:p-6">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <h2 className="flex items-center gap-2 text-xl font-extrabold text-white sm:text-2xl">
                  <FileWarning className="text-amber-300" size={22} />
                  Report Incident
                </h2>
                <p className="mt-1 text-sm text-slate-400">{shift.site.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowIncidentModal(false)}
                className="rounded-xl p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmitIncident} className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-300">Title</label>
                <input
                  value={incidentForm.title}
                  onChange={(event) => setIncidentForm({ ...incidentForm, title: event.target.value })}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:border-amber-300/50 focus:ring-2 focus:ring-amber-300/20"
                  placeholder="Brief incident summary"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-300">Description</label>
                <textarea
                  value={incidentForm.description}
                  onChange={(event) => setIncidentForm({ ...incidentForm, description: event.target.value })}
                  className="min-h-32 w-full resize-none rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:border-amber-300/50 focus:ring-2 focus:ring-amber-300/20"
                  placeholder="Describe what happened, who was involved, and any immediate action taken."
                  required
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-300">Severity</label>
                  <select
                    value={incidentForm.severity}
                    onChange={(event) => setIncidentForm({ ...incidentForm, severity: event.target.value as IncidentSeverity })}
                    className="w-full rounded-2xl border border-white/10 bg-[#132122] px-4 py-3 text-white outline-none focus:border-amber-300/50 focus:ring-2 focus:ring-amber-300/20"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-300">Occurred At</label>
                  <input
                    type="datetime-local"
                    value={incidentForm.occurredAt}
                    onChange={(event) => setIncidentForm({ ...incidentForm, occurredAt: event.target.value })}
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:border-amber-300/50 focus:ring-2 focus:ring-amber-300/20"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-300">Attachment URL Optional</label>
                <input
                  type="url"
                  value={incidentForm.attachmentUrl}
                  onChange={(event) => setIncidentForm({ ...incidentForm, attachmentUrl: event.target.value })}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:border-amber-300/50 focus:ring-2 focus:ring-amber-300/20"
                  placeholder="https://example.com/photo-or-report"
                />
              </div>

              <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setShowIncidentModal(false)}
                  className="rounded-2xl border border-white/10 px-5 py-3 text-sm font-bold text-slate-300 transition hover:bg-white/5 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={incidentLoading}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-amber-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {incidentLoading ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
                  Submit Incident
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </GuardLayout>
  );
}
