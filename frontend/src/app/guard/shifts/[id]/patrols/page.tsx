'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import GuardLayout from '@/components/GuardLayout';
import api from '@/lib/api';
import { getApiErrorMessage } from '@/lib/api-error';
import {
  PatrolRoute,
  PatrolRun,
  getShiftPatrolRoutes,
  startPatrolRun,
  scanPatrolCheckpoint,
  completePatrolRun,
  getGuardPatrolRuns,
} from '@/lib/patrols';
import {
  ArrowLeft,
  Navigation,
  CheckCircle2,
  Play,
  QrCode,
  MapPin,
  Clock,
  Loader2,
  AlertTriangle,
} from 'lucide-react';

interface GuardShiftDetail {
  id: string;
  startTime: string;
  endTime: string;
  attendanceStatus: 'not_started' | 'checked_in' | 'completed';
  site: {
    id: string;
    name: string;
    address: string;
  };
}

export default function GuardPatrolPage() {
  const params = useParams();
  const router = useRouter();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const [shift, setShift] = useState<GuardShiftDetail | null>(null);
  const [routes, setRoutes] = useState<PatrolRoute[]>([]);
  const [activeRun, setActiveRun] = useState<PatrolRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Scanning modal state
  const [scanningCheckpointId, setScanningCheckpointId] = useState<string | null>(null);
  const [scanNotes, setScanNotes] = useState('');
  const [scanStatus, setScanStatus] = useState<'completed' | 'skipped'>('completed');
  const [submittingScan, setSubmittingScan] = useState(false);

  const fetchPatrolContext = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError('');

      // 1. Fetch shift details to verify assignment and attendance status
      const shiftRes = await api.get<GuardShiftDetail>(`guard/shifts/${id}`);
      setShift(shiftRes.data);

      if (shiftRes.data.attendanceStatus !== 'checked_in') {
        setLoading(false);
        return;
      }

      // 2. Fetch routes for the shift
      const routesData = await getShiftPatrolRoutes(id);
      setRoutes(routesData);

      // 3. Check if there is an in-progress patrol run for this shift
      const runs = await getGuardPatrolRuns();
      const inProgress = runs.find(
        (run) => run.shiftId === id && run.status === 'in_progress',
      );

      if (inProgress) {
        // Fetch full run detail including already scanned checkpoints
        const fullRun = await api.get<PatrolRun>(`guard/patrol-runs/${inProgress.id}`);
        setActiveRun(fullRun.data);
      }
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to load patrol routes.'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchPatrolContext();
  }, [fetchPatrolContext]);

  const handleStartPatrol = async (routeId: string) => {
    if (!id) return;

    try {
      setLoading(true);
      const run = await startPatrolRun(id, { patrol_route_id: routeId });
      setActiveRun(run);
    } catch (err) {
      alert(getApiErrorMessage(err, 'Failed to start patrol run.'));
    } finally {
      setLoading(false);
    }
  };

  const handleOpenScan = (checkpointId: string) => {
    setScanningCheckpointId(checkpointId);
    setScanNotes('');
    setScanStatus('completed');
  };

  const handleConfirmScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRun || !scanningCheckpointId) return;

    try {
      setSubmittingScan(true);
      await scanPatrolCheckpoint(activeRun.id, scanningCheckpointId, {
        notes: scanNotes.trim() || undefined,
        status: scanStatus,
      });

      // Refresh run details
      const fullRun = await api.get<PatrolRun>(`guard/patrol-runs/${activeRun.id}`);
      setActiveRun(fullRun.data);
      setScanningCheckpointId(null);
    } catch (err) {
      alert(getApiErrorMessage(err, 'Failed to submit checkpoint scan.'));
    } finally {
      setSubmittingScan(false);
    }
  };

  const handleCompletePatrol = async () => {
    if (!activeRun) return;
    if (!confirm('Are you sure you want to finish this patrol run? Any unscanned checkpoints will be marked as missed.')) {
      return;
    }

    try {
      setLoading(true);
      await completePatrolRun(activeRun.id);
      setActiveRun(null);
      alert('Patrol run completed successfully.');
      router.push(`/guard/shifts/${id}`);
    } catch (err) {
      alert(getApiErrorMessage(err, 'Failed to complete patrol run.'));
    } finally {
      setLoading(false);
    }
  };

  // Calculate stats
  const totalCheckpoints = activeRun?.patrolRoute?.checkpoints?.length || 0;
  const completedCheckpoints = activeRun?.events?.filter(e => e.status === 'completed' || e.status === 'skipped').length || 0;
  const progressPercent = totalCheckpoints > 0 ? Math.round((completedCheckpoints / totalCheckpoints) * 100) : 0;

  return (
    <GuardLayout>
      <Link
        href={`/guard/shifts/${id}`}
        className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-slate-400 hover:text-white"
      >
        <ArrowLeft size={16} />
        Back to shift details
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-white sm:text-3xl">Patrol Routes</h1>
        {shift && <p className="text-sm text-slate-400 mt-1">{shift.site.name}</p>}
      </div>

      {loading ? (
        <div className="py-20 text-center text-slate-500">Loading patrol panel...</div>
      ) : error ? (
        <div className="rounded-3xl border border-rose-500/20 bg-rose-500/10 p-5 text-rose-300">
          <div className="flex items-center gap-3">
            <AlertTriangle size={20} />
            <span className="text-sm font-medium">{error}</span>
          </div>
        </div>
      ) : shift && shift.attendanceStatus !== 'checked_in' ? (
        <div className="rounded-3xl border border-amber-500/20 bg-amber-500/10 p-6 text-center text-amber-200">
          <AlertTriangle size={36} className="mx-auto mb-3 text-amber-300" />
          <h3 className="text-lg font-bold">Check-in Required</h3>
          <p className="text-sm text-slate-400 mt-1 max-w-md mx-auto">
            You must check in to your shift before starting or executing patrol routes.
          </p>
          <Link
            href={`/guard/shifts/${id}`}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-amber-400"
          >
            Go to Check In
          </Link>
        </div>
      ) : !activeRun ? (
        /* LIST OF AVAILABLE ROUTES */
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-white mb-2">Available Routes</h2>
          {routes.length === 0 ? (
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-10 text-center text-slate-500">
              No patrol routes configured for this site.
            </div>
          ) : (
            routes.map((route) => (
              <div
                key={route.id}
                className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:bg-white/[0.06] transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                    <Navigation size={22} />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-white">{route.name}</h3>
                    <p className="text-sm text-slate-400">{route.description || 'No description provided'}</p>
                    <span className="inline-block mt-2 text-xs font-semibold text-indigo-300">
                      {route.checkpoints?.length || 0} checkpoints
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => handleStartPatrol(route.id)}
                  className="w-full sm:w-auto inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white transition hover:bg-indigo-500 shadow-lg shadow-indigo-500/20"
                >
                  <Play size={16} />
                  <span>Start Patrol</span>
                </button>
              </div>
            ))
          )}
        </div>
      ) : (
        /* ACTIVE PATROL RUN CHECKLIST */
        <div className="space-y-6">
          <div className="rounded-3xl border border-indigo-500/30 bg-indigo-500/5 p-6">
            <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-indigo-400 mb-2">
              <Clock className="animate-pulse" size={14} />
              <span>Patrol In Progress</span>
            </div>
            <h2 className="text-2xl font-extrabold text-white">{activeRun.patrolRoute?.name}</h2>

            {/* PROGRESS BAR */}
            <div className="mt-6">
              <div className="flex justify-between items-center text-xs font-bold text-slate-400 mb-2">
                <span>PROGRESS</span>
                <span>
                  {completedCheckpoints} / {totalCheckpoints} SCAN{totalCheckpoints !== 1 ? 'S' : ''} ({progressPercent}%)
                </span>
              </div>
              <div className="w-full bg-white/10 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-indigo-500 h-full transition-all duration-300 rounded-full"
                  style={{ width: `${progressPercent}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* CHECKPOINTS CHECKLIST */}
          <div className="space-y-3">
            <h3 className="text-lg font-bold text-white px-1">Checkpoints Checklist</h3>
            {activeRun.patrolRoute?.checkpoints?.map((rcp, idx) => {
              const scannedEvent = activeRun.events?.find(e => e.checkpointId === rcp.checkpointId);
              const isScanned = !!scannedEvent;
              const isSkipped = scannedEvent?.status === 'skipped';

              return (
                <div
                  key={rcp.id}
                  className={`rounded-2xl border p-4 flex justify-between items-center gap-4 transition-all ${
                    isScanned
                      ? isSkipped
                        ? 'border-amber-500/20 bg-amber-500/5'
                        : 'border-emerald-500/20 bg-emerald-500/5'
                      : 'border-white/10 bg-white/[0.04]'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`font-mono text-xs font-bold w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                        isScanned
                          ? isSkipped
                            ? 'bg-amber-500/10 text-amber-400'
                            : 'bg-emerald-500/10 text-emerald-400'
                          : 'bg-white/10 text-slate-400'
                      }`}
                    >
                      {idx + 1}
                    </div>
                    <div className="min-w-0">
                      <span className="font-semibold text-white block text-sm sm:text-base truncate">
                        {rcp.checkpoint?.name}
                      </span>
                      {rcp.checkpoint?.locationNote && (
                        <span className="text-xs text-slate-400 block truncate">
                          Note: {rcp.checkpoint.locationNote}
                        </span>
                      )}
                      {scannedEvent?.notes && (
                        <span className="text-xs italic text-slate-400 block mt-1 truncate">
                          &ldquo;{scannedEvent.notes}&rdquo;
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0">
                    {isScanned ? (
                      <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                        <CheckCircle2 size={16} />
                        <span>Scanned</span>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleOpenScan(rcp.checkpointId)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-500 hover:bg-indigo-400 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-500/10"
                      >
                        <QrCode size={14} />
                        <span>Scan</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ACTION BUTTONS */}
          <div className="pt-4 border-t border-white/5 flex gap-4">
            <button
              onClick={handleCompletePatrol}
              className="w-full inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-bold transition-all shadow-lg shadow-emerald-500/10"
            >
              <CheckCircle2 size={18} />
              <span>Complete Patrol Run</span>
            </button>
          </div>
        </div>
      )}

      {/* SCAN CONFIRMATION MODAL */}
      {scanningCheckpointId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-[100] p-4 text-left">
          <div className="glass-card w-full max-w-md rounded-3xl border-white/10 p-5 shadow-3xl animate-in zoom-in-95 duration-200 sm:p-8">
            <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
              <QrCode className="text-indigo-400" size={20} />
              <span>Verify Checkpoint Scan</span>
            </h3>
            <p className="text-sm text-slate-400 mb-4">
              Enter any notes or observations about this checkpoint location.
            </p>

            <form onSubmit={handleConfirmScan} className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-300">Scan Status</label>
                <select
                  value={scanStatus}
                  onChange={(e) => setScanStatus(e.target.value as 'completed' | 'skipped')}
                  className="w-full rounded-2xl border border-white/10 bg-[#132122] px-4 py-3 text-white outline-none focus:border-indigo-500/50"
                >
                  <option value="completed" className="bg-[#0e0e1a]">Completed (Scanned OK)</option>
                  <option value="skipped" className="bg-[#0e0e1a]">Skipped / Obstruction</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-300">Observation Notes (Optional)</label>
                <textarea
                  value={scanNotes}
                  onChange={(e) => setScanNotes(e.target.value)}
                  className="min-h-24 w-full resize-none rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:border-indigo-500/50"
                  placeholder="e.g. Area is secure, doors locked."
                />
              </div>

              <div className="flex gap-4 pt-2">
                <button
                  type="button"
                  onClick={() => setScanningCheckpointId(null)}
                  className="flex-1 rounded-2xl border border-white/10 py-3 text-sm font-bold text-slate-300 transition hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingScan}
                  className="flex-1 rounded-2xl bg-indigo-500 hover:bg-indigo-400 py-3 text-sm font-bold text-white transition shadow-lg shadow-indigo-500/20 disabled:opacity-50"
                >
                  {submittingScan ? 'Confirming...' : 'Verify Scan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </GuardLayout>
  );
}
