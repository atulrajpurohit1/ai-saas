import api from './api';

export interface Checkpoint {
  id: string;
  tenantId: string;
  siteId: string;
  name: string;
  description: string | null;
  locationNote: string | null;
  qrCodeValue: string | null;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
  site?: {
    id: string;
    name: string;
  };
}

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
  checkpoint?: Checkpoint;
}

// Input Types
export interface CreateCheckpointInput {
  name: string;
  site_id: string;
  description?: string;
  location_note?: string;
  qr_code_value?: string;
}

export interface UpdateCheckpointInput {
  name?: string;
  description?: string;
  location_note?: string;
  qr_code_value?: string;
  status?: 'active' | 'inactive';
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

export async function getPatrolRuns() {
  const response = await api.get<PatrolRun[]>('patrol-runs');
  return response.data;
}

export async function getPatrolRun(id: string) {
  const response = await api.get<PatrolRun>(`patrol-runs/${id}`);
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

export async function completePatrolRun(runId: string) {
  const response = await api.post<PatrolRun>(`guard/patrol-runs/${runId}/complete`);
  return response.data;
}

export async function getGuardPatrolRuns() {
  const response = await api.get<PatrolRun[]>('guard/patrol-runs');
  return response.data;
}
