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

export async function getBranding() {
  const res = await api.get<BrandingSnapshot>('branding');
  return res.data;
}

// Branding is read-only: the endpoints that changed it, and custom domains,
// were removed on 1 Oct 2026 so no tenant can restyle the product.
