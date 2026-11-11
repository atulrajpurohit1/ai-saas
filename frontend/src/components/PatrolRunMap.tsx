'use client';

import React, { useMemo } from 'react';
import { Route } from 'lucide-react';
import PatrolMap, { MapPoint, MapPointTone, PatrolMapLegend } from '@/components/PatrolMap';
import { PatrolEvent, PatrolRun } from '@/lib/patrols';

function hasCoords(lat: number | null, lng: number | null): boolean {
  return lat !== null && lng !== null && !(lat === 0 && lng === 0);
}

// What colour a checkpoint pin gets. Deliberately the same precedence the
// timeline badges use: a wrong QR code outranks everything (the checkpoint
// may not have been visited at all), then a missed/skipped checkpoint, then
// a scan that landed outside the geofence.
function toneForEvent(event: PatrolEvent): MapPointTone {
  if (event.qrVerificationStatus === 'MISMATCH') return 'missed';
  if (event.status === 'missed') return 'missed';
  if (event.status === 'skipped') return 'issue';
  if (event.verificationStatus === 'OUTSIDE_GEOFENCE') return 'issue';
  return 'scanned';
}

function scanTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function summarise(event: PatrolEvent, index: number): string {
  const parts = [`Stop ${index + 1}`];
  if (event.status === 'missed') {
    parts.push('missed');
  } else {
    parts.push(`scanned ${scanTime(event.scannedAt)}`);
  }
  if (event.verificationStatus === 'OUTSIDE_GEOFENCE') {
    parts.push(
      typeof event.distanceMeters === 'number'
        ? `${event.distanceMeters}m outside geofence`
        : 'outside geofence',
    );
  }
  if (event.qrVerificationStatus === 'MISMATCH') parts.push('wrong QR code');
  if (event.notes) parts.push(`“${event.notes}”`);
  return parts.join(' · ');
}

export interface PatrolRunMapProps {
  run: PatrolRun;
  heightClassName?: string;
  allowFullscreen?: boolean;
  /** Point id to fly to - use `checkpointPointId(event.id)` to build one. */
  focusId?: string | null;
  focusNonce?: number;
}

/** The map point id for a checkpoint scan, so callers can focus one. */
export function checkpointPointId(eventId: string): string {
  return `cp-${eventId}`;
}

/**
 * The route a single patrol actually took: every checkpoint on it, coloured
 * by how the scan verified, joined by the path the guard's own device
 * reported. Where a scan failed its geofence the guard's real position is
 * pinned separately - that gap is the thing a supervisor opened this to see.
 */
export default function PatrolRunMap({
  run,
  heightClassName = 'h-[360px]',
  allowFullscreen = true,
  focusId,
  focusNonce,
}: PatrolRunMapProps) {
  const events = useMemo(() => run.events || [], [run.events]);

  const points = useMemo(() => {
    const result: MapPoint[] = [];

    events.forEach((event, index) => {
      const cp = event.checkpoint;
      if (cp && hasCoords(cp.latitude, cp.longitude)) {
        result.push({
          id: `cp-${event.id}`,
          latitude: cp.latitude as number,
          longitude: cp.longitude as number,
          label: cp.name,
          sublabel: summarise(event, index),
          tone: toneForEvent(event),
          badge: index + 1,
          radiusMeters: cp.geofenceRadiusMeters,
        });
      }

      // Only pinned when the scan was rejected on distance: otherwise the
      // guard's position and the checkpoint are the same place twice, and
      // the walked path already shows the route.
      if (
        event.verificationStatus === 'OUTSIDE_GEOFENCE' &&
        hasCoords(event.submittedLatitude, event.submittedLongitude)
      ) {
        result.push({
          id: `scan-${event.id}`,
          latitude: event.submittedLatitude as number,
          longitude: event.submittedLongitude as number,
          label: `Guard's position · ${cp?.name || 'checkpoint'}`,
          sublabel: `Where the scan was actually taken at ${scanTime(event.scannedAt)}${
            typeof event.distanceMeters === 'number' ? ` (${event.distanceMeters}m away)` : ''
          }`,
          tone: 'issue',
        });
      }
    });

    // The guard's current/last known position, on top of the route.
    if (hasCoords(run.lastLatitude, run.lastLongitude)) {
      result.push({
        id: 'guard-live',
        latitude: run.lastLatitude as number,
        longitude: run.lastLongitude as number,
        label: run.guard?.name ? `${run.guard.name} (last known)` : 'Guard (last known)',
        sublabel: run.lastLocationAt
          ? `Reported at ${new Date(run.lastLocationAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}${
              typeof run.lastAccuracyMeters === 'number'
                ? ` · ±${Math.round(run.lastAccuracyMeters)}m accuracy`
                : ''
            }`
          : null,
        tone: 'guard',
        pulse: run.status === 'in_progress',
      });
    }

    return result;
  }, [events, run]);

  // Where the guard's device said it was, in scan order - the events already
  // arrive sorted by scannedAt. Falls back to the checkpoint's own position
  // for scans taken without a GPS fix, so one missing fix doesn't cut the
  // path in half.
  const trail = useMemo(() => {
    const path = events
      .filter((event) => event.status !== 'missed')
      .map((event) => {
        if (hasCoords(event.submittedLatitude, event.submittedLongitude)) {
          return { latitude: event.submittedLatitude as number, longitude: event.submittedLongitude as number };
        }
        const cp = event.checkpoint;
        if (cp && hasCoords(cp.latitude, cp.longitude)) {
          return { latitude: cp.latitude as number, longitude: cp.longitude as number };
        }
        return null;
      })
      .filter((p): p is { latitude: number; longitude: number } => p !== null);

    if (run.status === 'in_progress' && hasCoords(run.lastLatitude, run.lastLongitude)) {
      path.push({ latitude: run.lastLatitude as number, longitude: run.lastLongitude as number });
    }
    return path;
  }, [events, run]);

  const missing = events.filter((event) => {
    const cp = event.checkpoint;
    return !cp || !hasCoords(cp.latitude, cp.longitude);
  }).length;

  return (
    <div>
      <PatrolMap
        points={points}
        trail={trail}
        focusId={focusId}
        focusNonce={focusNonce}
        heightClassName={heightClassName}
        allowFullscreen={allowFullscreen}
        missingCoordinatesCount={missing}
        emptyTitle="This patrol has no mapped positions"
        emptyHint="None of the checkpoints on this route have GPS coordinates set, and the guard's device reported no location."
      />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <PatrolMapLegend
          items={[
            { tone: 'scanned', label: 'Scanned' },
            { tone: 'issue', label: 'Skipped / outside geofence' },
            { tone: 'missed', label: 'Missed / wrong QR' },
            { tone: 'guard', label: 'Guard position' },
          ]}
        />
        {trail.length > 1 && (
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Route size={12} />
            The dashed line is the order the guard walked it.
          </span>
        )}
      </div>
    </div>
  );
}
