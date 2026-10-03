import api from '@/lib/api';

export interface BrandingSnapshot {
  company_name: string;
  logo_url: string | null;
  favicon_url: string | null;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  login_background: string | null;
  welcome_message: string | null;
  support_email: string | null;
  support_phone: string | null;
}

export interface CustomDomain {
  id: string;
  tenant_id: string;
  domain: string;
  verification_status: string;
  ssl_status: string;
  verification_token: string;
  verification_record: string;
  verification_error?: string;
  verified_at?: string | null;
  created_at: string;
  updated_at?: string;
}

export type BrandingUpdatePayload = {
  [Key in keyof BrandingSnapshot]?: BrandingSnapshot[Key] | null;
};

export async function getBranding() {
  const res = await api.get<BrandingSnapshot>('branding');
  return res.data;
}

export async function updateBranding(data: BrandingUpdatePayload) {
  const res = await api.put<BrandingSnapshot>('branding', data);
  return res.data;
}

export async function getCustomDomains() {
  const res = await api.get<CustomDomain[]>('branding/domains');
  return res.data;
}

export async function addCustomDomain(domain: string) {
  const res = await api.post<CustomDomain>('branding/domains', { domain });
  return res.data;
}

export async function verifyCustomDomain(id: string) {
  const res = await api.post<CustomDomain>(`branding/domains/${id}/verify`);
  return res.data;
}
