import api from '@/lib/api';

export interface BillingLimit {
  used: number;
  limit: number | null;
  remaining: number | null;
  percent: number | null;
  exceeded: boolean;
}

export interface BillingPlan {
  key: string;
  name: string;
  monthlyPrice: number | null;
  source?: string;
  limits?: Record<string, number | null>;
}

export interface TenantBilling {
  tenant: {
    id: string;
    name: string;
    slug: string;
    createdAt: string;
  } | null;
  plan: BillingPlan;
  limits: Record<string, BillingLimit>;
  features: Record<string, boolean>;
  availablePlans: BillingPlan[];
}

export async function getTenantBilling() {
  const res = await api.get<TenantBilling>('billing');
  return res.data;
}

export interface CheckoutAvailability {
  configured: boolean;
  monthly: string[];
  annual: string[];
}

/**
 * Whether self-serve purchase is switched on. Until pricing is configured in
 * Stripe this reports `configured: false`, and the plan page offers a contact
 * route instead of a buy button that would 503.
 */
export async function getCheckoutAvailability(): Promise<CheckoutAvailability> {
  const res = await api.get<CheckoutAvailability>('billing/checkout/availability');
  return res.data;
}

export async function startCheckout(
  modules: string[],
  interval: 'monthly' | 'annual' = 'monthly',
): Promise<{ url: string | null }> {
  const res = await api.post<{ url: string | null }>('billing/checkout/session', {
    modules,
    interval,
  });
  return res.data;
}

export async function openBillingPortal(): Promise<{ url: string }> {
  const res = await api.post<{ url: string }>('billing/portal/session', {});
  return res.data;
}
