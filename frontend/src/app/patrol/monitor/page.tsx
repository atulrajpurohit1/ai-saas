'use client';

import React, { useCallback, useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import PageHeader from '@/components/PageHeader';
import LoadingState from '@/components/LoadingState';
import ErrorState from '@/components/ErrorState';
import EmptyState from '@/components/EmptyState';
import StatusBadge from '@/components/StatusBadge';
import { getPatrolOverview, PatrolOverview, PatrolOverviewRun } from '@/lib/patrols';
import { getApiErrorMessage } from '@/lib/api-error';
import {
  ADMIN_LOCATION_POLL_INTERVAL_MS,
  LOCATION_STALE_THRESHOLD_MS,
} from '@/lib/guard-tracking.constants';
import {
  Radar,
  MapPin,
  MapPinOff,
  ExternalLink,
  ShieldAlert,
  CheckCircle2,
  Footprints,
  Users,
} from 'lucide-react';

function relativeTime(iso: string | null): string {
  if (!iso) return 'never';
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function isLocationStale(at: string | null): boolean {
  if (!at) return true;
  return Date.now() - new Date(at).getTime() > LOCATION_STALE_THRESHOLD_MS;
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone = 'neutral',
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: number;
  tone?: 'neutral' | 'primary' | 'warning' | 'success';
}) {
  const toneClass =
    tone === 'primary'
      ? 'text-primary'
      : tone === 'warning'
        ? 'text-warning'
        : tone === 'success'
          ? 'text-success'
          : 'text-foreground';
  return (
    <div className="rounded-[var(--radius-lg)] border border-border bg-card p-4 shadow-sm">
      <div className="mb-2 flex items-center gap-2 text-eyebrow">
        <Icon size={14} />
        {label}
      </div>
      <div className={`text-2xl font-bold ${toneClass}`}>{value}</div>
    </div>
  );
}

function LocationCell({ run }: { run: PatrolOverviewRun }) {
  const loc = run.location;
  if (!loc || loc.latitude === null || loc.longitude === null || !loc.at) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        <MapPinOff size={13} />
        No location yet
      </span>
    );
  }
  const stale = isLocationStale(loc.at);
  const mapsUrl = `https://www.google.com/maps?q=${loc.latitude},${loc.longitude}`;
  return (
    <a
      href={mapsUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
        stale ? 'text-warning' : 'text-success'
      } hover:underline`}
    >
      <MapPin size={13} />
      {stale ? 'Stale' : 'Live'} · {relativeTime(loc.at)}
      <ExternalLink size={11} />
    </a>
  );
}

export default function PatrolMonitorPage() {
  const [overview, setOverview] = useState<PatrolOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (showLoader = false) => {
    if (showLoader) setLoading(true);
    try {
      const data = await getPatrolOverview();
      setOverview(data);
      setError('');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not load the patrol overview.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(true);
    const timer = setInterval(() => load(false), ADMIN_LOCATION_POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [load]);

  return (
    <DashboardLayout requiredPermissions="patrols.view">
      <PageHeader
        title="Patrol Monitor"
        description="Live cross-guard, cross-site view of every patrol in progress today."
      />

      {loading ? (
        <LoadingState label="Loading patrol overview…" />
      ) : error ? (
        <ErrorState message={error} onRetry={() => load(true)} />
      ) : overview ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
            <StatCard icon={Radar} label="Active patrols" value={overview.summary.activeRuns} tone="primary" />
            <StatCard icon={Users} label="Guards on patrol" value={overview.summary.guardsOnPatrol} tone="primary" />
            <StatCard icon={CheckCircle2} label="Completed today" value={overview.summary.completedToday} tone="success" />
            <StatCard icon={Footprints} label="Checkpoints today" value={overview.summary.checkpointsScannedToday} />
            <StatCard icon={ShieldAlert} label="Missed today" value={overview.summary.missedCheckpointsToday} tone="warning" />
            <StatCard icon={MapPinOff} label="Geofence fails" value={overview.summary.geofenceFailuresToday} tone="warning" />
          </div>

          <section>
            <h2 className="mb-3 text-section-title">In progress ({overview.activeRuns.length})</h2>
            {overview.activeRuns.length === 0 ? (
              <EmptyState icon={Radar} title="No patrols in progress" description="Active patrol runs across all guards and sites will appear here." />
            ) : (
              <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-border bg-card shadow-sm">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-eyebrow">
                      <th className="px-4 py-3 font-semibold">Guard</th>
                      <th className="px-4 py-3 font-semibold">Site / Route</th>
                      <th className="px-4 py-3 font-semibold">Checkpoints</th>
                      <th className="px-4 py-3 font-semibold">Started</th>
                      <th className="px-4 py-3 font-semibold">Location</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.activeRuns.map((run) => (
                      <tr key={run.id} className="border-b border-border last:border-0">
                        <td className="px-4 py-3 font-semibold text-foreground">{run.guard?.name ?? '—'}</td>
                        <td className="px-4 py-3">
                          <div className="text-foreground">{run.site?.name ?? '—'}</div>
                          <div className="text-xs text-muted-foreground">{run.route?.name ?? 'No route'}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-semibold text-foreground">
                            {run.checkpoints.scanned}/{run.checkpoints.total}
                          </span>
                          {run.checkpoints.missed > 0 && (
                            <span className="ml-2 text-xs font-semibold text-warning">{run.checkpoints.missed} missed</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{relativeTime(run.startedAt)}</td>
                        <td className="px-4 py-3"><LocationCell run={run} /></td>
                        <td className="px-4 py-3"><StatusBadge status={run.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {overview.completedToday.length > 0 && (
            <section>
              <h2 className="mb-3 text-section-title">Completed today ({overview.completedToday.length})</h2>
              <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-border bg-card shadow-sm">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-eyebrow">
                      <th className="px-4 py-3 font-semibold">Guard</th>
                      <th className="px-4 py-3 font-semibold">Site / Route</th>
                      <th className="px-4 py-3 font-semibold">Checkpoints</th>
                      <th className="px-4 py-3 font-semibold">Completed</th>
                      <th className="px-4 py-3 font-semibold">Issues</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.completedToday.map((run) => (
                      <tr key={run.id} className="border-b border-border last:border-0">
                        <td className="px-4 py-3 font-semibold text-foreground">{run.guard?.name ?? '—'}</td>
                        <td className="px-4 py-3">
                          <div className="text-foreground">{run.site?.name ?? '—'}</div>
                          <div className="text-xs text-muted-foreground">{run.route?.name ?? 'No route'}</div>
                        </td>
                        <td className="px-4 py-3 font-semibold text-foreground">
                          {run.checkpoints.scanned}/{run.checkpoints.total}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{relativeTime(run.completedAt)}</td>
                        <td className="px-4 py-3">
                          {run.checkpoints.missed === 0 && run.geofenceFailures === 0 ? (
                            <span className="text-xs font-semibold text-success">Clean</span>
                          ) : (
                            <span className="text-xs font-semibold text-warning">
                              {run.checkpoints.missed > 0 && `${run.checkpoints.missed} missed`}
                              {run.checkpoints.missed > 0 && run.geofenceFailures > 0 && ', '}
                              {run.geofenceFailures > 0 && `${run.geofenceFailures} geofence`}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <p className="text-xs text-muted-foreground">
            Updated {relativeTime(overview.generatedAt)} · refreshes automatically
          </p>
        </div>
      ) : null}
    </DashboardLayout>
  );
}
