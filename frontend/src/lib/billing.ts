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

export type PackageKey = 'GENERATION' | 'GUARD' | 'OPERATIONS' | 'COMPLETE';

export type GuardBand =
  | '1-25'
  | '26-50'
  | '51-100'
  | '101-250'
  | '251-500'
  | '500+';

export interface PlanPackage {
  key: PackageKey;
  name: string;
  modules: string[];
  /** Monthly list price per band; null means quoted by sales. */
  monthly: Record<GuardBand, number | null>;
  /** Bands that can be bought online right now. */
  sellableBands: GuardBand[];
}

export interface PlanPricing {
  /** Whether any plan can be bought online at all. */
  configured: boolean;
  bands: { key: GuardBand; min: number; max: number | null }[];
  packages: PlanPackage[];
  /** Generation on its own is always charged at this band. */
  generationOnlyBand: GuardBand;
  /** Guards rostered in the last 30 days. */
  activeGuards: number;
  /** The lowest band this account may choose. */
  minimumBand: GuardBand;
  /** The plan the Stripe subscription is on, if there is one. */
  current: { packageKey: PackageKey; band: GuardBand } | null;
}

export async function getPlanPricing(): Promise<PlanPricing> {
  const res = await api.get<PlanPricing>('billing/plan');
  return res.data;
}

/**
 * Starts checkout for a package at a guard band. An account that already has
 * a subscription is switched onto the new plan instead, in which case there is
 * no checkout link and `changed` is true.
 */
export async function startPlanCheckout(
  packageKey: PackageKey,
  band: GuardBand,
): Promise<{ url: string | null; changed: boolean }> {
  const res = await api.post<{ url: string | null; changed: boolean }>(
    'billing/checkout/session',
    { package: packageKey, band },
  );
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
    /** A full discovery search. */
    discoverySearch: number;
    /**
     * A preview discovery search (asking for previewLimit results or fewer).
     * Optional: an older backend charges every search the full price and
     * does not send it.
     */
    discoveryPreview?: number;
    previewLimit?: number;
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
