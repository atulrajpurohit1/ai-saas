import api from '@/lib/api';

export interface SsoRoleMapping {
  id?: string;
  external_group: string;
  role_id: string;
  branch_id?: string | null;
}

export interface SsoProvider {
  id: string;
  tenant_id: string;
  provider_type: string;
  provider_name: string;
  client_id?: string | null;
  client_secret_configured: boolean;
  issuer_url?: string | null;
  metadata_url?: string | null;
  saml_metadata_configured: boolean;
  email_domains: string[];
  auto_provision: boolean;
  default_role_id?: string | null;
  default_branch_id?: string | null;
  status: string;
  created_at: string;
  updated_at?: string;
  role_mappings: SsoRoleMapping[];
}

export interface UserSession {
  id: string;
  tenant_id: string;
  user_id: string;
  user: { id: string; email: string; name?: string | null; branchId?: string | null };
  provider?: { id: string; providerType: string; providerName: string } | null;
  source: string;
  status: string;
  ip_address?: string | null;
  user_agent?: string | null;
  last_seen_at: string;
  expires_at: string;
  created_at: string;
  revoked_at?: string | null;
}

export async function getSsoProviders() {
  const res = await api.get<SsoProvider[]>('sso/providers');
  return res.data;
}

export async function createSsoProvider(data: Partial<SsoProvider> & {
  provider_type: string;
  provider_name: string;
  client_secret?: string;
}) {
  const res = await api.post<SsoProvider>('sso/providers', data);
  return res.data;
}

export async function updateSsoProvider(id: string, data: Partial<SsoProvider> & { client_secret?: string }) {
  const res = await api.put<SsoProvider>(`sso/providers/${id}`, data);
  return res.data;
}

export async function testSsoProvider(providerId: string) {
  const res = await api.post('sso/test', { provider_id: providerId });
  return res.data;
}

export async function startSsoLogin(email: string) {
  const res = await api.post<{ redirect_url: string }>('auth/sso/login', { email });
  return res.data;
}

export async function getSessions() {
  const res = await api.get<UserSession[]>('sessions');
  return res.data;
}

export async function revokeSession(id: string) {
  const res = await api.delete<UserSession>(`sessions/${id}`);
  return res.data;
}
