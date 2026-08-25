// Reusable geographic distance/validation utilities (Phase 3A). Pure
// functions, no I/O, no framework dependencies - safe to reuse from any
// future tracking feature without pulling in an external maps API.

export interface Coordinates {
  latitude: number;
  longitude: number;
}

const EARTH_RADIUS_METERS = 6_371_000;

/** True for a numerically valid, geographically possible coordinate pair. */
export function isValidCoordinate(latitude: unknown, longitude: unknown): boolean {
  return (
    typeof latitude === 'number' &&
    typeof longitude === 'number' &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Great-circle distance between two coordinates in meters, via the
 * Haversine formula. Assumes both points are already valid coordinates -
 * callers should check `isValidCoordinate` first for anything user-supplied.
 */
export function haversineDistanceMeters(a: Coordinates, b: Coordinates): number {
  const dLat = toRadians(b.latitude - a.latitude);
  const dLng = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);

  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));

  return EARTH_RADIUS_METERS * c;
}

/** True when `point` is within `radiusMeters` of `center`. */
export function isWithinRadius(center: Coordinates, point: Coordinates, radiusMeters: number): boolean {
  return haversineDistanceMeters(center, point) <= radiusMeters;
}
