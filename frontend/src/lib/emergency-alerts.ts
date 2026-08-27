import api from './api';

// Mirrors backend/src/emergency-alerts/emergency-alert-status.util.ts exactly.
// Status is always computed/derived server-side - never set by the client.
export type EmergencyAlertStatus = 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED';

export interface EmergencyAlertUserRef {
  id: string;
  name: string | null;
  email: string;
}

export interface EmergencyAlertLocation {
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  capturedAt: string | null;
}

export interface EmergencyAlert {
  id: string;
  status: EmergencyAlertStatus;
  triggeredAt: string;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  notes: string | null;
  guard: { id: string; name: string; phone: string | null } | null;
  branch: { id: string; name: string } | null;
  site: { id: string; name: string } | null;
  patrolRoute: { id: string; name: string } | null;
  patrolRunId: string | null;
  acknowledgedBy: EmergencyAlertUserRef | null;
  resolvedBy: EmergencyAlertUserRef | null;
  location: EmergencyAlertLocation | null;
  createdAt: string;
  updatedAt: string;
}

// Guard - identity/tenant/patrol context are all derived server-side from
// the authenticated guard's JWT; there is no request body to spoof.
export async function triggerEmergencyAlert(): Promise<EmergencyAlert> {
  const res = await api.post<EmergencyAlert>('guard/emergency-alerts');
  return res.data;
}

export async function getActiveEmergencyAlert(): Promise<EmergencyAlert | null> {
  const res = await api.get<EmergencyAlert | null>('guard/emergency-alerts/active');
  return res.data;
}

// Admin/dispatcher
export async function getEmergencyAlerts(status?: EmergencyAlertStatus): Promise<EmergencyAlert[]> {
  const res = await api.get<EmergencyAlert[]>('emergency-alerts', {
    params: status ? { status } : undefined,
  });
  return res.data;
}

export async function acknowledgeEmergencyAlert(id: string, notes?: string): Promise<EmergencyAlert> {
  const res = await api.post<EmergencyAlert>(`emergency-alerts/${id}/acknowledge`, { notes });
  return res.data;
}

export async function resolveEmergencyAlert(id: string, notes?: string): Promise<EmergencyAlert> {
  const res = await api.post<EmergencyAlert>(`emergency-alerts/${id}/resolve`, { notes });
  return res.data;
}
