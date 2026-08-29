import api from './api';
import { branchParams, BranchSummary } from './branches';

export type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical';
export type IncidentStatus = 'submitted' | 'under_review' | 'approved' | 'rejected';

export interface Incident {
  id: string;
  tenantId: string;
  branchId?: string | null;
  shiftId: string;
  siteId: string;
  guardId: string;
  title: string;
  description: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  occurredAt: string;
  attachmentUrl: string | null;
  notes: string | null;
  createdAt: string;
  submittedAt: string;
  reviewedById: string | null;
  reviewedBy: {
    id: string;
    name: string | null;
    email: string | null;
  } | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  site: {
    id: string;
    name: string;
    address: string;
  };
  guard: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
  };
  shift: {
    id: string;
    startTime: string;
    endTime: string;
  };
  branch?: BranchSummary | null;
}

export interface CreateIncidentInput {
  title: string;
  description: string;
  severity: IncidentSeverity;
  occurred_at: string;
  attachment_url?: string;
}

export interface ReviewIncidentInput {
  status: Extract<IncidentStatus, 'approved' | 'rejected'>;
  review_note?: string;
}

export async function createGuardIncident(shiftId: string, input: CreateIncidentInput) {
  const response = await api.post<Incident>(`guard/shifts/${shiftId}/incidents`, input);
  return response.data;
}

export async function getGuardIncidents() {
  const response = await api.get<Incident[]>('guard/incidents');
  return response.data;
}

export async function getAdminIncidents(branchId?: string | null) {
  const response = await api.get<Incident[]>('incidents', { params: branchParams(branchId) });
  return response.data;
}

export async function getIncidentReviewQueue(branchId?: string | null) {
  const response = await api.get<Incident[]>('incidents/review-queue', { params: branchParams(branchId) });
  return response.data;
}

export async function getAdminIncident(id: string) {
  const response = await api.get<Incident>(`incidents/${id}`);
  return response.data;
}

export async function reviewIncident(id: string, input: ReviewIncidentInput) {
  const response = await api.post<Incident>(`incidents/${id}/review`, input);
  return response.data;
}

// --- Phase 3F: incident evidence (photo/video) attachments -----------------

export type IncidentEvidenceMediaType = 'image' | 'video';

export interface IncidentEvidence {
  id: string;
  incidentId: string;
  mediaType: IncidentEvidenceMediaType;
  mimeType: string;
  fileName: string;
  fileSizeBytes: number;
  uploadedById: string | null;
  createdAt: string;
}

// `apiBase` is 'incidents' for the admin portal or 'client/incidents' for the
// client portal - the axios instance attaches the correct portal token based
// on the current path, so the same helpers serve both.
export type IncidentEvidenceScope = 'incidents' | 'client/incidents';

export async function getIncidentEvidence(
  apiBase: IncidentEvidenceScope,
  incidentId: string,
): Promise<IncidentEvidence[]> {
  const response = await api.get<IncidentEvidence[]>(
    `${apiBase}/${incidentId}/evidence`,
  );
  return response.data;
}

export async function uploadIncidentEvidence(
  incidentId: string,
  file: File,
): Promise<IncidentEvidence> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await api.post<IncidentEvidence>(
    `incidents/${incidentId}/evidence`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return response.data;
}

export async function deleteIncidentEvidence(
  incidentId: string,
  evidenceId: string,
): Promise<void> {
  await api.delete(`incidents/${incidentId}/evidence/${evidenceId}`);
}

// Streams the binary through the authenticated axios instance and hands back
// an object URL for use as an <img>/<video> src. Callers must revokeObjectURL
// when done.
export async function fetchIncidentEvidenceObjectUrl(
  apiBase: IncidentEvidenceScope,
  incidentId: string,
  evidenceId: string,
): Promise<string> {
  const response = await api.get(
    `${apiBase}/${incidentId}/evidence/${evidenceId}/file`,
    { responseType: 'blob' },
  );
  return URL.createObjectURL(response.data as Blob);
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / 1024 ** exponent;
  return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}
