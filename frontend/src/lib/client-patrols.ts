import api from './api';

// Phase 3E: client-facing "guard on site now" status. Location is a
// snapshot reused from Phase 3B's PatrolRun tracking - null whenever the
// guard has no active patrol, never fabricated.
export interface ClientSiteGuardLocation {
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  capturedAt: string | null;
}

export interface ClientSiteGuardStatus {
  guardId: string;
  guardName: string;
  shiftId: string;
  patrolRoute: { id: string; name: string } | null;
  location: ClientSiteGuardLocation | null;
}

export interface ClientSiteLiveStatus {
  site: { id: string; name: string; address: string };
  guardsOnSite: ClientSiteGuardStatus[];
}

export async function getClientSitesLiveStatus(): Promise<ClientSiteLiveStatus[]> {
  const res = await api.get<ClientSiteLiveStatus[]>('client/patrols/live-status');
  return res.data;
}
