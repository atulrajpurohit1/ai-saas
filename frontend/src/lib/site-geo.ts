// Incidents and sites carry no GPS of their own, but a site's checkpoints do
// (Phase 3A). Until incidents capture a real per-report fix, this derives an
// approximate site location from the average of that site's GPS checkpoints,
// so an incident can be shown on a map at (roughly) the right place.
import { Checkpoint } from './patrols';

export interface LatLng {
  latitude: number;
  longitude: number;
}

function hasGps(cp: Checkpoint): boolean {
  return (
    cp.latitude !== null &&
    cp.longitude !== null &&
    !(cp.latitude === 0 && cp.longitude === 0)
  );
}

/**
 * siteId -> the centroid of that site's GPS-tagged checkpoints. A site whose
 * checkpoints have no coordinates is simply absent from the map, which the
 * caller surfaces as a "not mappable" count rather than a silent drop.
 */
export function deriveSiteLocations(checkpoints: Checkpoint[]): Map<string, LatLng> {
  const acc = new Map<string, { lat: number; lng: number; n: number }>();
  for (const cp of checkpoints) {
    if (!hasGps(cp)) continue;
    const cur = acc.get(cp.siteId) || { lat: 0, lng: 0, n: 0 };
    cur.lat += cp.latitude as number;
    cur.lng += cp.longitude as number;
    cur.n += 1;
    acc.set(cp.siteId, cur);
  }
  const result = new Map<string, LatLng>();
  for (const [siteId, { lat, lng, n }] of acc) {
    result.set(siteId, { latitude: lat / n, longitude: lng / n });
  }
  return result;
}

// A stable hash of a string into [0, 1). Same id always maps to the same
// value, so a given incident's offset never jumps between renders.
function hash01(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // >>> 0 to an unsigned int, then scale into [0, 1).
  return (h >>> 0) / 4294967295;
}

/**
 * Spreads several points that share one derived site location so they don't
 * stack into a single un-clickable pin. The offset is deterministic per id
 * (so it's stable across refreshes) and small — roughly a 30m ring — because
 * this is a "somewhere on this property" marker, not a survey fix.
 */
export function jitterAround(center: LatLng, id: string, radiusMeters = 30): LatLng {
  const angle = hash01(id) * Math.PI * 2;
  // A second, decorrelated hash for the distance, so points don't all land on
  // one circle. sqrt keeps them spread evenly across the disc, not bunched
  // at the centre.
  const distance = Math.sqrt(hash01(`${id}:r`)) * radiusMeters;
  const dLat = (distance * Math.cos(angle)) / 111320;
  const dLng =
    (distance * Math.sin(angle)) /
    (111320 * Math.cos((center.latitude * Math.PI) / 180) || 1);
  return { latitude: center.latitude + dLat, longitude: center.longitude + dLng };
}

export type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical';

// A four-step danger ramp. Distinct enough that high and critical don't read
// as the same pin, which the fixed map tone set couldn't guarantee.
export const INCIDENT_SEVERITY_COLORS: Record<IncidentSeverity, string> = {
  low: '#2563eb', // blue - informational
  medium: '#d97706', // amber
  high: '#dc2626', // red
  critical: '#7f1d1d', // dark red
};

export function severityColor(severity: string): string {
  return INCIDENT_SEVERITY_COLORS[severity as IncidentSeverity] || '#6b7280';
}
