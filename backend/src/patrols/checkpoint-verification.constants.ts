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
