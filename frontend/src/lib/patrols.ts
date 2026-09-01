import api from './api';

export interface Checkpoint {
  id: string;
  tenantId: string;
  siteId: string;
  name: string;
  description: string | null;
  locationNote: string | null;
  qrCodeValue: string | null;
  // GPS geofence (Phase 3A) - null/null/null means this checkpoint has no
  // geofence configured yet and scans against it are NO_GEOFENCE_CONFIGURED.
  latitude: number | null;
  longitude: number | null;
  geofenceRadiusMeters: number | null;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
  site?: {
    id: string;
    name: string;
  };
}

// Mirrors backend/src/patrols/checkpoint-verification.constants.ts exactly -
// always computed server-side from submitted coordinates, never client-set.
export type CheckpointVerificationStatus =
  | 'SUCCESS'
  | 'OUTSIDE_GEOFENCE'
  | 'LOCATION_UNAVAILABLE'
  | 'NO_GEOFENCE_CONFIGURED'
  | 'INVALID_LOCATION';

export interface PatrolRouteCheckpoint {
  id: string;
  patrolRouteId: string;
  checkpointId: string;
  sequenceOrder: number;
  checkpoint: Checkpoint;
}

export interface PatrolRoute {
  id: string;
  tenantId: string;
  siteId: string;
  name: string;
  description: string | null;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
  site?: {
    id: string;
    name: string;
  };
  checkpoints?: PatrolRouteCheckpoint[];
}

export interface PatrolRun {
  id: string;
  tenantId: string;
  shiftId: string;
  guardId: string;
  patrolRouteId: string;
  status: 'not_started' | 'in_progress' | 'completed' | 'missed';
  startedAt: string | null;
  completedAt: string | null;
  // Live tracking (Phase 3B) - the LATEST known guard location for this run
  // only, not a history. Present only while/after the run has received at
  // least one location update.
  lastLatitude: number | null;
  lastLongitude: number | null;
  lastAccuracyMeters: number | null;
  lastLocationAt: string | null;
  createdAt: string;
  updatedAt: string;
  patrolRoute?: {
    id: string;
    name: string;
    checkpoints?: PatrolRouteCheckpoint[];
  };
  guard?: {
    id: string;
    name: string;
  };
  shift?: {
    id: string;
    startTime: string;
    endTime: string;
    site: {
      id: string;
      name: string;
    };
  };
  events?: PatrolEvent[];
}

export interface PatrolEvent {
  id: string;
  tenantId: string;
  patrolRunId: string;
  checkpointId: string;
  guardId: string;
  scannedAt: string;
  status: 'completed' | 'missed' | 'skipped';
  notes: string | null;
  verificationStatus: CheckpointVerificationStatus | null;
  distanceMeters: number | null;
  submittedLatitude: number | null;
  submittedLongitude: number | null;
  checkpoint?: Checkpoint;
}

// Input Types
export interface CreateCheckpointInput {
  name: string;
  site_id: string;
  description?: string;
  location_note?: string;
  qr_code_value?: string;
  latitude?: number;
  longitude?: number;
  geofence_radius_meters?: number;
}

export interface UpdateCheckpointInput {
  name?: string;
  description?: string;
  location_note?: string;
  qr_code_value?: string;
  status?: 'active' | 'inactive';
  latitude?: number;
  longitude?: number;
  geofence_radius_meters?: number;
  clear_geofence?: boolean;
}

export interface CreatePatrolRouteInput {
  name: string;
  site_id: string;
  description?: string;
}

export interface UpdatePatrolRouteInput {
  name?: string;
  description?: string;
  status?: 'active' | 'inactive';
}

export interface AttachCheckpointItem {
  checkpoint_id: string;
  sequence_order: number;
}

export interface AttachCheckpointsInput {
  checkpoints: AttachCheckpointItem[];
}

export interface StartPatrolRunInput {
  patrol_route_id: string;
}

export interface ScanCheckpointInput {
  notes?: string;
  status?: 'completed' | 'skipped';
  // Raw device coordinates only - the server computes the verification
  // result itself, it never accepts a verdict from the client.
  latitude?: number;
  longitude?: number;
}

export interface UpdateLocationInput {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp?: string;
}

// API Calls - Admin
export async function createCheckpoint(input: CreateCheckpointInput) {
  const response = await api.post<Checkpoint>('checkpoints', input);
  return response.data;
}

export async function getCheckpoints(siteId?: string) {
  const response = await api.get<Checkpoint[]>('checkpoints', {
    params: siteId ? { site_id: siteId } : undefined,
  });
  return response.data;
}

export async function updateCheckpoint(id: string, input: UpdateCheckpointInput) {
  const response = await api.put<Checkpoint>(`checkpoints/${id}`, input);
  return response.data;
}

export async function createPatrolRoute(input: CreatePatrolRouteInput) {
  const response = await api.post<PatrolRoute>('patrol-routes', input);
  return response.data;
}

export async function getPatrolRoutes(siteId?: string) {
  const response = await api.get<PatrolRoute[]>('patrol-routes', {
    params: siteId ? { site_id: siteId } : undefined,
  });
  return response.data;
}

export async function getPatrolRoute(id: string) {
  const response = await api.get<PatrolRoute>(`patrol-routes/${id}`);
  return response.data;
}

export async function updatePatrolRoute(id: string, input: UpdatePatrolRouteInput) {
  const response = await api.put<PatrolRoute>(`patrol-routes/${id}`, input);
  return response.data;
}

export async function attachRouteCheckpoints(routeId: string, input: AttachCheckpointsInput) {
  const response = await api.post<PatrolRoute>(`patrol-routes/${routeId}/checkpoints`, input);
  return response.data;
}

export async function getPatrolRuns(status?: PatrolRun['status']) {
  const response = await api.get<PatrolRun[]>('patrol-runs', {
    params: status ? { status } : undefined,
  });
  return response.data;
}

export async function getPatrolRun(id: string) {
  const response = await api.get<PatrolRun>(`patrol-runs/${id}`);
  return response.data;
}

// Admin-side aggregate patrol-monitoring overview.
export interface PatrolOverviewRun {
  id: string;
  status: string;
  active: boolean;
  startedAt: string | null;
  completedAt: string | null;
  guard: { id: string; name: string } | null;
  route: { id: string; name: string } | null;
  site: { id: string; name: string } | null;
  shift: { id: string; startTime: string; endTime: string } | null;
  checkpoints: { scanned: number; total: number; missed: number };
  geofenceFailures: number;
  lastScanAt: string | null;
  location: {
    latitude: number | null;
    longitude: number | null;
    accuracyMeters: number | null;
    at: string | null;
  } | null;
}

export interface PatrolOverview {
  generatedAt: string;
  summary: {
    activeRuns: number;
    guardsOnPatrol: number;
    completedToday: number;
    checkpointsScannedToday: number;
    missedCheckpointsToday: number;
    geofenceFailuresToday: number;
  };
  activeRuns: PatrolOverviewRun[];
  completedToday: PatrolOverviewRun[];
}

export async function getPatrolOverview() {
  const response = await api.get<PatrolOverview>('patrol-runs/overview');
  return response.data;
}

// API Calls - Guard
export async function getShiftPatrolRoutes(shiftId: string) {
  const response = await api.get<PatrolRoute[]>(`guard/shifts/${shiftId}/patrol-routes`);
  return response.data;
}

export async function startPatrolRun(shiftId: string, input: StartPatrolRunInput) {
  const response = await api.post<PatrolRun>(`guard/shifts/${shiftId}/patrol-runs/start`, input);
  return response.data;
}

export async function scanPatrolCheckpoint(runId: string, checkpointId: string, input?: ScanCheckpointInput) {
  const response = await api.post<PatrolEvent>(
    `guard/patrol-runs/${runId}/checkpoints/${checkpointId}/scan`,
    input || {},
  );
  return response.data;
}

export async function updateGuardLocation(runId: string, input: UpdateLocationInput) {
  const response = await api.post<PatrolRun>(`guard/patrol-runs/${runId}/location`, input);
  return response.data;
}

export async function completePatrolRun(runId: string) {
  const response = await api.post<PatrolRun>(`guard/patrol-runs/${runId}/complete`);
  return response.data;
}

export async function getGuardPatrolRuns() {
  const response = await api.get<PatrolRun[]>('guard/patrol-runs');
  return response.data;
}
