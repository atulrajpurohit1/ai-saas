import api from '@/lib/api';

export interface UserSession {
  id: string;
  tenant_id: string;
  user_id: string;
  user: { id: string; email: string; name?: string | null; branchId?: string | null };
  source: string;
  status: string;
  ip_address?: string | null;
  user_agent?: string | null;
  last_seen_at: string;
  expires_at: string;
  created_at: string;
  revoked_at?: string | null;
}

export async function getSessions() {
  const res = await api.get<UserSession[]>('sessions');
  return res.data;
}

export async function revokeSession(id: string) {
  const res = await api.delete<UserSession>(`sessions/${id}`);
  return res.data;
}
