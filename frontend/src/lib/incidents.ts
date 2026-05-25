import api from './api';

export type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical';
export type IncidentStatus = 'submitted' | 'reviewed' | 'rejected';

export interface Incident {
  id: string;
  tenantId: string;
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
}

export interface CreateIncidentInput {
  title: string;
  description: string;
  severity: IncidentSeverity;
  occurred_at: string;
  attachment_url?: string;
}

export async function createGuardIncident(shiftId: string, input: CreateIncidentInput) {
  const response = await api.post<Incident>(`guard/shifts/${shiftId}/incidents`, input);
  return response.data;
}

export async function getGuardIncidents() {
  const response = await api.get<Incident[]>('guard/incidents');
  return response.data;
}

export async function getAdminIncidents() {
  const response = await api.get<Incident[]>('incidents');
  return response.data;
}

export async function getAdminIncident(id: string) {
  const response = await api.get<Incident>(`incidents/${id}`);
  return response.data;
}
