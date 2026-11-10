// Phase 3A checkpoint geofence verification outcomes. These are the ONLY
// values ever written to PatrolEvent.verificationStatus - always computed
// server-side (see PatrolsService.verifyCheckpointLocation), never accepted
// from the client.
export enum CheckpointVerificationStatus {
  SUCCESS = 'SUCCESS',
  OUTSIDE_GEOFENCE = 'OUTSIDE_GEOFENCE',
  LOCATION_UNAVAILABLE = 'LOCATION_UNAVAILABLE',
  NO_GEOFENCE_CONFIGURED = 'NO_GEOFENCE_CONFIGURED',
  INVALID_LOCATION = 'INVALID_LOCATION',
}

export const DEFAULT_GEOFENCE_RADIUS_METERS = 50;
export const MIN_GEOFENCE_RADIUS_METERS = 5;
export const MAX_GEOFENCE_RADIUS_METERS = 2000;

// QR checkpoint-identity verification outcomes. Same contract as the
// geofence statuses above: the ONLY values ever written to
// PatrolEvent.qrVerificationStatus, always computed server-side (see
// PatrolsService.verifyCheckpointQr) from the raw string the guard's device
// decoded - the client never supplies a verdict.
//
// A mismatch never rejects the scan. It is recorded and flagged, exactly
// like OUTSIDE_GEOFENCE, so a guard is never blocked from logging a
// checkpoint by a damaged, replaced or mislabelled QR sticker - the
// supervisor sees the discrepancy on the patrol log instead.
export enum CheckpointQrVerificationStatus {
  // The decoded value matches this checkpoint's configured QR value.
  SUCCESS = 'SUCCESS',
  // A value was decoded but it is not this checkpoint's - typically the
  // guard scanned the sticker of a different checkpoint.
  MISMATCH = 'MISMATCH',
  // The checkpoint has a QR value configured but the guard submitted none
  // (manual / fallback scan).
  NOT_PROVIDED = 'NOT_PROVIDED',
  // The checkpoint itself has no QR value, so there is nothing to verify.
  NO_QR_CONFIGURED = 'NO_QR_CONFIGURED',
}

// QR payloads are short identifiers, not documents. Capping the accepted
// length keeps a malformed/hostile decode from being persisted verbatim.
export const MAX_QR_CODE_VALUE_LENGTH = 512;

// Comparison is whitespace-trimmed and case-insensitive: the same physical
// sticker can be decoded with trailing newlines by some scanner libraries,
// and a value may also be typed by hand as a fallback.
export function normalizeQrCodeValue(
  value: string | null | undefined,
): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

export function qrCodeValuesMatch(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const left = normalizeQrCodeValue(a);
  const right = normalizeQrCodeValue(b);
  if (left === null || right === null) return false;
  return left.toLowerCase() === right.toLowerCase();
}
