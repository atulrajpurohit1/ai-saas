'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

export interface TenantBranding {
  company_name: string;
  logo_url?: string | null;
  favicon_url?: string | null;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  login_background?: string | null;
  welcome_message?: string | null;
  support_email?: string | null;
  support_phone?: string | null;
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

const fallbackBranding: TenantBranding = {
  company_name: 'Ai Saas',
  logo_url: null,
  favicon_url: null,
  primary_color: '#6366f1',
  secondary_color: '#334155',
  accent_color: '#818cf8',
  login_background: null,
  welcome_message: null,
  support_email: null,
  support_phone: null,
};

const BrandingContext = createContext<{ branding: TenantBranding }>({ branding: fallbackBranding });

export async function getPublicBranding(domain?: string, tenantSlug?: string) {
  const res = await api.get<TenantBranding>('branding/public', {
    params: {
      domain,
      tenant_slug: tenantSlug,
    },
  });
  return res.data;
}

export async function getBranding() {
  const res = await api.get<TenantBranding>('branding');
  return res.data;
}

export async function updateBranding(data: Partial<Record<keyof TenantBranding, string | null>>) {
  const res = await api.put<TenantBranding>('branding', data);
  return res.data;
}

export async function getDomains() {
  const res = await api.get<CustomDomain[]>('branding/domains');
  return res.data;
}

export async function addDomain(domain: string) {
  const res = await api.post<CustomDomain>('branding/domains', { domain });
  return res.data;
}

export async function verifyDomain(id: string) {
  const res = await api.post<CustomDomain>(`branding/domains/${id}/verify`);
  return res.data;
}

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [branding, setBranding] = useState<TenantBranding>(fallbackBranding);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const nextBranding = user ? await getBranding() : await getPublicBranding(window.location.hostname);
        if (mounted) setBranding({ ...fallbackBranding, ...nextBranding });
      } catch {
        if (mounted) setBranding(fallbackBranding);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, [user?.tenantId]);

  useEffect(() => {
    applyBranding(branding);
  }, [branding]);

  return (
    <BrandingContext.Provider value={{ branding }}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding() {
  return useContext(BrandingContext);
}

function applyBranding(branding: TenantBranding) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.style.setProperty('--primary', branding.primary_color);
  root.style.setProperty('--secondary', branding.secondary_color);
  root.style.setProperty('--accent', branding.accent_color);

  document.title = branding.company_name || 'Ai Saas';
  const favicon = branding.favicon_url || branding.logo_url;
  if (favicon) {
    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = favicon;
  }
}
