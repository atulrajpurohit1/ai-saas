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
