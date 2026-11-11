'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import PageHeader from '@/components/PageHeader';
import LoadingState from '@/components/LoadingState';
import ErrorState from '@/components/ErrorState';
import EmptyState from '@/components/EmptyState';
import StatusBadge from '@/components/StatusBadge';
import PatrolMap, { MapPoint, PatrolMapLegend } from '@/components/PatrolMap';
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
  ScanLine,
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

function LocationCell({
  run,
  onShowOnMap,
}: {
  run: PatrolOverviewRun;
  onShowOnMap: (runId: string) => void;
}) {
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
    <span className="inline-flex items-center gap-2">
      {/* Primary action is the overview map on this page; Google Maps stays
          available for turn-by-turn directions to the guard. */}
      <button
        type="button"
        onClick={() => onShowOnMap(run.id)}
        className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
          stale ? 'text-warning' : 'text-success'
        } hover:underline`}
        title="Show this guard on the map above"
      >
        <MapPin size={13} />
        {stale ? 'Stale' : 'Live'} · {relativeTime(loc.at)}
      </button>
      <a
        href={mapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-muted-foreground transition-colors hover:text-foreground"
        title="Open in Google Maps"
      >
        <ExternalLink size={11} />
      </a>
    </span>
  );
}

// A run's verification problems, in one cell. A wrong QR code is listed
// first and in the danger tone because, unlike a missed checkpoint or a weak
// GPS fix, it means a checkpoint was logged against the wrong identity -
// the one outcome that warrants looking at the patrol log itself.
function RunIssues({ run }: { run: PatrolOverviewRun }) {
  const problems: string[] = [];
  if (run.qrMismatches > 0) problems.push(`${run.qrMismatches} wrong QR`);
  if (run.checkpoints.missed > 0) problems.push(`${run.checkpoints.missed} missed`);
  if (run.geofenceFailures > 0) problems.push(`${run.geofenceFailures} geofence`);

  if (problems.length === 0) {
    return <span className="text-xs font-semibold text-success">Clean</span>;
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
        run.qrMismatches > 0 ? 'text-destructive' : 'text-warning'
      }`}
    >
      {run.qrMismatches > 0 && <ScanLine size={12} />}
      {problems.join(', ')}
    </span>
  );
}

export default function PatrolMonitorPage() {
  const [overview, setOverview] = useState<PatrolOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mapFocusId, setMapFocusId] = useState<string | null>(null);
  const [mapFocusNonce, setMapFocusNonce] = useState(0);
  const mapRef = useRef<HTMLDivElement | null>(null);

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

  // One pin per guard currently on patrol, at their last reported position.
  // A guard whose device has gone quiet is drawn in the warning tone rather
  // than dropped off the map - "last seen here 20 minutes ago" is exactly
  // what a supervisor needs at that moment.
  const activePoints: MapPoint[] = useMemo(() => {
    if (!overview) return [];
    return overview.activeRuns
      .filter((run) => run.location && run.location.latitude !== null && run.location.longitude !== null)
      .map((run) => {
        const loc = run.location as NonNullable<PatrolOverviewRun['location']>;
        const stale = isLocationStale(loc.at);
        return {
          id: run.id,
          latitude: loc.latitude as number,
          longitude: loc.longitude as number,
          label: run.guard?.name ?? 'Unknown guard',
          sublabel: [
            run.site?.name,
            run.route?.name,
            `${run.checkpoints.scanned}/${run.checkpoints.total} checkpoints`,
            `${stale ? 'last seen' : 'updated'} ${relativeTime(loc.at)}`,
          ]
            .filter(Boolean)
            .join(' · '),
          tone: stale ? 'issue' : 'guard',
          pulse: !stale,
        } satisfies MapPoint;
      });
  }, [overview]);

  const activeWithoutLocation = overview
    ? overview.activeRuns.length - activePoints.length
    : 0;

  const showRunOnMap = useCallback((runId: string) => {
    setMapFocusId(runId);
    setMapFocusNonce((n) => n + 1);
    mapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, []);

  return (
    <DashboardLayout requiredModule="GUARD_TOUR" requiredPermissions="patrols.view">
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
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-7">
            <StatCard icon={Radar} label="Active patrols" value={overview.summary.activeRuns} tone="primary" />
            <StatCard icon={Users} label="Guards on patrol" value={overview.summary.guardsOnPatrol} tone="primary" />
            <StatCard icon={CheckCircle2} label="Completed today" value={overview.summary.completedToday} tone="success" />
            <StatCard icon={Footprints} label="Checkpoints today" value={overview.summary.checkpointsScannedToday} />
            {/* "Missed today" read as missed patrols. It counts checkpoints
                skipped inside completed patrols; patrols themselves are
                voluntary and unscheduled, so there is nothing to miss. */}
            <StatCard icon={ShieldAlert} label="Checkpoints missed today" value={overview.summary.missedCheckpointsToday} tone="warning" />
            <StatCard icon={MapPinOff} label="Geofence fails" value={overview.summary.geofenceFailuresToday} tone="warning" />
            <StatCard icon={ScanLine} label="Wrong QR scans" value={overview.summary.qrMismatchesToday} tone="warning" />
          </div>

          <section ref={mapRef} className="scroll-mt-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-section-title">Live map</h2>
              <span className="text-xs text-muted-foreground">
                Every guard on patrol right now, at their last reported position.
              </span>
            </div>
            <div className="rounded-[var(--radius-lg)] border border-border bg-card p-4 shadow-sm">
              <PatrolMap
                points={activePoints}
                focusId={mapFocusId}
                focusNonce={mapFocusNonce}
                missingCoordinatesCount={activeWithoutLocation}
                heightClassName="h-[420px]"
                emptyTitle="No guard positions to show"
                emptyHint="Positions appear here once a guard starts a patrol and their device reports a location."
              />
              <PatrolMapLegend
                className="mt-3"
                items={[
                  { tone: 'guard', label: 'Live position' },
                  { tone: 'issue', label: 'Last known (stale)' },
                ]}
              />
            </div>
          </section>

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
                      {/* Surfaced while the patrol is still running, so a
                          supervisor can intervene rather than read about it
                          afterwards. */}
                      <th className="px-4 py-3 font-semibold">Issues</th>
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
                        <td className="px-4 py-3"><LocationCell run={run} onShowOnMap={showRunOnMap} /></td>
                        <td className="px-4 py-3"><RunIssues run={run} /></td>
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
                        <td className="px-4 py-3"><RunIssues run={run} /></td>
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
