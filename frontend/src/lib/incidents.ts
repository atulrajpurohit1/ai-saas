import api from './api';
import { branchParams, BranchSummary } from './branches';
import { KnowledgeEntry } from './knowledge-base';

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
  similarHistoricalCases?: KnowledgeEntry[];
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
