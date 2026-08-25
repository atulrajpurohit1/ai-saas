'use client';

import React, { useCallback, useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Search, ShieldAlert, Eye, Calendar, Clock, CheckCircle2, AlertCircle, XCircle, Plus, MapPin, MapPinOff, Radar, ExternalLink } from 'lucide-react';
import { PatrolRun, getPatrolRuns, getPatrolRun } from '@/lib/patrols';
import { formatEnumLabel } from '@/lib/format';
import { ADMIN_LOCATION_POLL_INTERVAL_MS, LOCATION_STALE_THRESHOLD_MS } from '@/lib/guard-tracking.constants';

function isLocationStale(lastLocationAt: string | null): boolean {
  if (!lastLocationAt) return true;
  return Date.now() - new Date(lastLocationAt).getTime() > LOCATION_STALE_THRESHOLD_MS;
}

function relativeTime(iso: string): string {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function LiveLocationCard({ run }: { run: PatrolRun }) {
  if (run.lastLatitude === null || run.lastLongitude === null || !run.lastLocationAt) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs font-semibold text-slate-400">
        <Radar size={14} />
        Waiting for the guard&apos;s first location update…
      </div>
    );
  }

  const stale = isLocationStale(run.lastLocationAt);
  const mapsUrl = `https://www.google.com/maps?q=${run.lastLatitude},${run.lastLongitude}`;

  return (
    <div
      className={`rounded-2xl border px-4 py-3 ${
        stale ? 'border-amber-500/20 bg-amber-500/5' : 'border-emerald-500/20 bg-emerald-500/5'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={`inline-flex items-center gap-1.5 text-xs font-bold ${stale ? 'text-amber-300' : 'text-emerald-300'}`}>
          <Radar size={13} className={stale ? '' : 'animate-pulse'} />
          {stale ? 'Last known location (stale)' : 'Live location'}
        </span>
        <span className="text-[11px] font-semibold text-slate-400">Updated {relativeTime(run.lastLocationAt)}</span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-300">
        <span className="font-mono">
          {run.lastLatitude.toFixed(5)}, {run.lastLongitude.toFixed(5)}
        </span>
        {typeof run.lastAccuracyMeters === 'number' && (
          <span className="text-slate-500">±{Math.round(run.lastAccuracyMeters)}m accuracy</span>
        )}
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-indigo-300 hover:text-indigo-200"
        >
          Open in Maps
          <ExternalLink size={11} />
        </a>
      </div>
    </div>
  );
}

function geofenceBadge(status: string | null | undefined, distanceMeters: number | null | undefined) {
  switch (status) {
    case 'SUCCESS':
      return { label: 'Location verified', className: 'bg-emerald-500/10 text-emerald-400', icon: MapPin };
    case 'OUTSIDE_GEOFENCE':
      return {
        label: `Outside geofence${typeof distanceMeters === 'number' ? ` (${distanceMeters}m)` : ''}`,
        className: 'bg-amber-500/10 text-amber-400',
        icon: MapPinOff,
      };
    case 'LOCATION_UNAVAILABLE':
      return { label: 'Location unavailable', className: 'bg-amber-500/10 text-amber-400', icon: MapPinOff };
    case 'INVALID_LOCATION':
      return { label: 'Invalid location', className: 'bg-amber-500/10 text-amber-400', icon: MapPinOff };
    case 'NO_GEOFENCE_CONFIGURED':
    default:
      return null;
  }
}

export default function PatrolRunsPage() {
  const [runs, setRuns] = useState<PatrolRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Selected run for detailed view
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [selectedRunDetail, setSelectedRunDetail] = useState<PatrolRun | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Phase 3B: currently-active guards, polled independently of the full
  // (potentially large, historical) runs list below.
  const [liveRuns, setLiveRuns] = useState<PatrolRun[]>([]);
  const [liveLoading, setLiveLoading] = useState(true);

  const fetchRuns = async () => {
    try {
      setLoading(true);
      const res = await getPatrolRuns();
      setRuns(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchLiveRuns = useCallback(async () => {
    try {
      const res = await getPatrolRuns('in_progress');
      setLiveRuns(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLiveLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRuns();
  }, []);

  useEffect(() => {
    fetchLiveRuns();
    const intervalId = setInterval(fetchLiveRuns, ADMIN_LOCATION_POLL_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [fetchLiveRuns]);

  const handleViewDetails = async (runId: string) => {
    setSelectedRunId(runId);
    setLoadingDetail(true);
    try {
      const details = await getPatrolRun(runId);
      setSelectedRunDetail(details);
    } catch (err) {
      console.error(err);
      alert('Failed to load patrol run details');
      setSelectedRunId(null);
    } finally {
      setLoadingDetail(false);
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
      case 'in_progress':
        return 'bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse';
      case 'missed':
        return 'bg-red-500/10 text-red-400 border border-red-500/20';
      case 'not_started':
      default:
        return 'bg-white/5 text-muted-foreground border border-white/10';
    }
  };

  const formatDuration = (start?: string | null, end?: string | null) => {
    if (!start) return 'N/A';
    const startTime = new Date(start).getTime();
    const endTime = end ? new Date(end).getTime() : new Date().getTime();
    const diffMs = endTime - startTime;
    const diffMins = Math.round(diffMs / 60000);
    return `${diffMins} min${diffMins !== 1 ? 's' : ''}`;
  };

  const filteredRuns = runs.filter((run) => {
    const query = searchQuery.toLowerCase();
    return (
      !searchQuery ||
      run.patrolRoute?.name.toLowerCase().includes(query) ||
      run.guard?.name.toLowerCase().includes(query) ||
      run.shift?.site.name.toLowerCase().includes(query)
    );
  });

  return (
    <DashboardLayout>
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h2 className="text-2xl font-bold sm:text-3xl">Patrol Logs</h2>
          <p className="text-muted-foreground">Monitor guard patrol runs, scan checkpoints, and completion timelines.</p>
        </div>
      </div>

      {/* LIVE GUARDS - Phase 3B */}
      <div className="glass-card mb-6 rounded-3xl border border-white/5 p-5 sm:p-6">
        <div className="mb-4 flex items-center gap-2">
          <Radar className="text-indigo-400" size={20} />
          <h3 className="text-lg font-bold text-white">Live Guards</h3>
          <span className="ml-auto text-xs font-bold uppercase tracking-widest text-muted-foreground">
            {liveRuns.length} on patrol
          </span>
        </div>
        {liveLoading ? (
          <div className="py-6 text-center text-sm text-muted-foreground">Loading live guards…</div>
        ) : liveRuns.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 py-6 text-center text-sm text-muted-foreground">
            No guards currently on patrol.
          </div>
        ) : (
          <div className="space-y-3">
            {liveRuns.map((run) => (
              <div key={run.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div>
                    <span className="block text-sm font-bold text-white">{run.guard?.name || 'Unknown Guard'}</span>
                    <span className="block text-xs text-muted-foreground">
                      {run.patrolRoute?.name} &middot; {run.shift?.site.name}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleViewDetails(run.id)}
                    className="text-xs font-bold text-indigo-300 hover:text-indigo-200"
                  >
                    View patrol
                  </button>
                </div>
                <LiveLocationCard run={run} />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="glass-card rounded-3xl overflow-hidden border border-white/5">
        <div className="border-b border-white/5 bg-white/5 p-4 sm:p-6">
          <div className="relative w-full sm:max-w-sm">
            <Search className="absolute left-3 top-2.5 text-muted-foreground" size={18} />
            <input
              type="text"
              placeholder="Search by guard, route or site..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-10 pr-4 focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="responsive-table w-full text-left">
            <thead>
              <tr className="text-muted-foreground text-sm uppercase tracking-wider">
                <th className="px-6 py-4 font-semibold">Route / Site</th>
                <th className="px-6 py-4 font-semibold">Guard</th>
                <th className="px-6 py-4 font-semibold">Patrol Status</th>
                <th className="px-6 py-4 font-semibold">Started At</th>
                <th className="px-6 py-4 font-semibold">Duration</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-muted-foreground">
                    Loading patrol logs...
                  </td>
                </tr>
              ) : filteredRuns.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-muted-foreground">
                    No patrol runs found.
                  </td>
                </tr>
              ) : (
                filteredRuns.map((run) => (
                  <tr key={run.id} className="hover:bg-white/5 transition-colors group">
                    <td className="px-6 py-4" data-label="Route / Site">
                      <div>
                        <span className="font-semibold block">{run.patrolRoute?.name || 'Unknown Route'}</span>
                        <span className="text-xs text-muted-foreground">{run.shift?.site.name || 'Unknown Site'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 align-middle" data-label="Guard">
                      <span className="text-sm font-medium">{run.guard?.name || 'Unknown Guard'}</span>
                    </td>
                    <td className="px-6 py-4 align-middle" data-label="Status">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${getStatusStyle(run.status)}`}>
                        {formatEnumLabel(run.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 align-middle text-sm text-muted-foreground" data-label="Started">
                      {run.startedAt ? new Date(run.startedAt).toLocaleString() : 'Not started'}
                    </td>
                    <td className="px-6 py-4 align-middle text-sm text-muted-foreground" data-label="Duration">
                      {formatDuration(run.startedAt, run.completedAt)}
                    </td>
                    <td className="px-6 py-4 text-right align-middle" data-label="Actions">
                      <button
                        onClick={() => handleViewDetails(run.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 ml-auto bg-white/5 hover:bg-white/10 rounded-xl transition-all text-xs font-bold text-white border border-white/10"
                      >
                        <Eye size={14} />
                        <span>View detail</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* PATROL RUN DETAILS MODAL */}
      {selectedRunId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 text-left">
          <div className="glass-card max-h-[calc(100dvh-2rem)] w-full max-w-2xl overflow-y-auto rounded-3xl border-white/10 p-5 shadow-3xl animate-in zoom-in-95 duration-200 sm:p-8">
            <div className="flex items-center justify-between mb-6 border-b border-white/5 pb-4">
              <div>
                <h3 className="text-2xl font-bold">Patrol Run Execution</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  ID: {selectedRunId.slice(0, 8)}...
                </p>
              </div>
              <button
                onClick={() => {
                  setSelectedRunId(null);
                  setSelectedRunDetail(null);
                }}
                className="text-muted-foreground hover:text-white transition-colors"
              >
                <Plus size={24} className="rotate-45" />
              </button>
            </div>

            {loadingDetail ? (
              <div className="py-20 text-center text-muted-foreground">Loading execution details...</div>
            ) : !selectedRunDetail ? (
              <div className="py-20 text-center text-red-400">Failed to load patrol run details.</div>
            ) : (
              <div className="space-y-6">
                {/* METADATA GRID */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-white/5 border border-white/5 p-4 rounded-2xl">
                  <div>
                    <span className="text-xs text-muted-foreground block">Route / Site</span>
                    <span className="font-semibold text-sm">{selectedRunDetail.patrolRoute?.name}</span>
                    <span className="text-xs text-muted-foreground block">{selectedRunDetail.shift?.site.name}</span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block">Guard</span>
                    <span className="font-semibold text-sm">{selectedRunDetail.guard?.name}</span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block">Execution Period</span>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                      <Calendar size={12} />
                      <span>
                        {selectedRunDetail.startedAt ? new Date(selectedRunDetail.startedAt).toLocaleDateString() : 'N/A'}
                      </span>
                      <Clock size={12} className="ml-1" />
                      <span>
                        {selectedRunDetail.startedAt ? new Date(selectedRunDetail.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                        {selectedRunDetail.completedAt ? ` - ${new Date(selectedRunDetail.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
                      </span>
                    </div>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block">Completion State</span>
                    <span className={`inline-block mt-1 rounded-full px-2 py-0.5 text-xs font-bold ${getStatusStyle(selectedRunDetail.status)}`}>
                      {formatEnumLabel(selectedRunDetail.status)}
                    </span>
                  </div>
                </div>

                {selectedRunDetail.status === 'in_progress' && (
                  <div>
                    <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">Live Location</h4>
                    <LiveLocationCard run={selectedRunDetail} />
                  </div>
                )}

                {/* TIMELINE LIST */}
                <div>
                  <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-4">Checkpoint Scan Checklist</h4>
                  <div className="relative border-l-2 border-white/5 ml-3 pl-6 space-y-6">
                    {selectedRunDetail.events && selectedRunDetail.events.length === 0 ? (
                      <div className="text-sm text-muted-foreground text-center py-6">No checkpoints scanned during this patrol.</div>
                    ) : (
                      selectedRunDetail.events?.map((event) => {
                        const isCompleted = event.status === 'completed';
                        const isSkipped = event.status === 'skipped';
                        const isMissed = event.status === 'missed';

                        return (
                          <div key={event.id} className="relative">
                            {/* Timeline node */}
                            <div className="absolute -left-[35px] top-0.5 w-6 h-6 rounded-full flex items-center justify-center bg-[#0d0d1e]">
                              {isCompleted && <CheckCircle2 className="text-emerald-400" size={20} />}
                              {isSkipped && <AlertCircle className="text-amber-400" size={20} />}
                              {isMissed && <XCircle className="text-red-400" size={20} />}
                            </div>

                            <div>
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                                <span className="font-semibold text-sm">{event.checkpoint?.name || 'Unknown Checkpoint'}</span>
                                <span className="text-xs text-muted-foreground font-mono">
                                  {new Date(event.scannedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                </span>
                              </div>
                              {event.checkpoint?.locationNote && (
                                <span className="text-xs text-muted-foreground block mt-0.5">
                                  Location: {event.checkpoint.locationNote}
                                </span>
                              )}
                              {event.notes && (
                                <div className="mt-1.5 p-2 bg-white/5 border border-white/10 rounded-lg text-xs italic text-muted-foreground max-w-md">
                                  &ldquo;{event.notes}&rdquo;
                                </div>
                              )}
                              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                <span className={`inline-block text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.25 rounded-md ${
                                  isCompleted ? 'bg-emerald-500/10 text-emerald-400' :
                                  isSkipped ? 'bg-amber-500/10 text-amber-400' : 'bg-red-500/10 text-red-400'
                                }`}>
                                  {event.status}
                                </span>
                                {(() => {
                                  const badge = geofenceBadge(event.verificationStatus, event.distanceMeters);
                                  if (!badge) return null;
                                  const Icon = badge.icon;
                                  return (
                                    <span className={`inline-flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.25 rounded-md ${badge.className}`}>
                                      <Icon size={10} />
                                      {badge.label}
                                    </span>
                                  );
                                })()}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="border-t border-white/5 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedRunId(null);
                      setSelectedRunDetail(null);
                    }}
                    className="w-full bg-white/5 hover:bg-white/10 text-white font-bold py-3 rounded-2xl transition-all border border-white/10"
                  >
                    Close Log
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
