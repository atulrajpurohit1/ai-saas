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

// --- Prospect Search credits ---------------------------------------------

export interface CreditBalance {
  balance: number;
  lifetimePurchased: number;
  lifetimeConsumed: number;
  /** Credits held by searches that have not finished yet. */
  reservedPending: number;
}

export interface CreditPack {
  key: string;
  label: string;
  credits: number;
  price: number;
}

export interface CreditPackAvailability {
  configured: boolean;
  packs: CreditPack[];
  /**
   * What each kind of search costs, as a flat price per search. Both are set
   * server-side and can change without a frontend deploy, so they are always
   * read from here rather than hard-coded into copy.
   *
   * `perProspect` is a retired field the API now always sends as null:
   * discovery used to be billed per prospect returned and no longer is. Kept
   * in the type so the null is handled deliberately rather than surprising an
   * older build.
   */
  costs: {
    playbook: number;
    discoverySearch: number;
    perProspect: number | null;
  };
}

export type CreditLedgerEntryType =
  | 'PURCHASE'
  | 'RESERVATION'
  | 'RELEASE'
  | 'CONSUMPTION'
  | 'ADJUSTMENT';

export interface CreditLedgerEntry {
  id: string;
  type: CreditLedgerEntryType;
  amount: number;
  balanceAfter: number;
  description: string;
  createdAt: string;
}

export async function getCreditBalance(): Promise<CreditBalance> {
  const res = await api.get<CreditBalance>('billing/credits');
  return res.data;
}

export async function getCreditPacks(): Promise<CreditPackAvailability> {
  const res = await api.get<CreditPackAvailability>('billing/credits/packs');
  return res.data;
}

export async function getCreditLedger(limit = 50): Promise<CreditLedgerEntry[]> {
  const res = await api.get<CreditLedgerEntry[]>('billing/credits/ledger', {
    params: { limit },
  });
  return res.data;
}

export async function startCreditCheckout(
  pack: string,
): Promise<{ url: string | null }> {
  const res = await api.post<{ url: string | null }>(
    'billing/credits/checkout/session',
    { pack },
  );
  return res.data;
}
