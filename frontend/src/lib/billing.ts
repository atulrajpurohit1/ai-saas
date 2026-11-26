import api from '@/lib/api';

export interface TenantBilling {
  tenant: {
    id: string;
    name: string;
    slug: string;
    createdAt: string;
  } | null;
  /** Raw counts. There are no per-plan caps -- pricing is by guard band. */
  usage: Record<string, number>;
  entitlements: {
    status: string;
    modules: { key: string; name: string; active: boolean }[];
  } | null;
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

export type LeadGenTierKey = 'STARTER' | 'PRO' | 'ELITE';

/**
 * One Lead Gen starting plan. Lead Gen is not priced by guard count: it is a
 * flat monthly price made of the platform fee plus credits that are handed
 * over ONCE, when the plan starts. They never expire, so there is nothing to
 * refill -- only the plan recurs.
 */
export interface LeadGenTier {
  key: LeadGenTierKey;
  name: string;
  tagline: string;
  /** Credits included once, at purchase. */
  includedCredits: number;
  /** The part of `price` that buys those credits. */
  creditsPrice: number;
  /** Monthly list price: base + credits. */
  price: number;
  popular: boolean;
}

export interface LeadGenPlans {
  name: string;
  modules: string[];
  /** The platform fee: the monthly price with no credits in it. */
  basePrice: number;
  tiers: LeadGenTier[];
  /** Starting plans that can be bought online right now. */
  sellableTiers: LeadGenTierKey[];
  currentTier: LeadGenTierKey | null;
  /** Whether this account may buy the base plan (no credits). */
  baseSellable: boolean;
    /** Legacy availability hint; the base plan is now open to first-time buyers. */
  baseRequiresPlan: boolean;
  /** Already on Lead Gen at the base price, with no credits included. */
  onBasePlan: boolean;
}

export interface PlanPricing {
  /** Automatic first-invoice offers for new subscriptions. */
  sales?: Record<
    PackageKey,
    {
      id: string;
      name: string;
      percentOff: number;
      bonusCredits: number;
      endsAt: string;
    } | null
  >;
  saleEligible?: boolean;
  /** Whether any plan can be bought online at all. */
  configured: boolean;
  bands: { key: GuardBand; min: number; max: number | null }[];
  /** Only the packages priced by guards; Lead Gen is in `leadGen`. */
  packages: PlanPackage[];
  /**
   * The Lead Gen plans. Optional: an older backend does not send them, and the
   * page falls back to showing the chart alone rather than rendering nothing.
   */
  leadGen?: LeadGenPlans;
  /** Generation on its own is always charged at this band. */
  generationOnlyBand: GuardBand;
  /** Every guard on the account. Guards are billed for the full month. */
  billableGuards: number;
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
 * Starts checkout for a package at a guard band, or -- for GENERATION, which
 * is not priced by guards -- for a Lead Gen tier. An account that already has
 * a subscription is switched onto the new plan instead, in which case there is
 * no checkout link and `changed` is true.
 */
export async function startPlanCheckout(
  packageKey: PackageKey,
  band: GuardBand,
  tier?: LeadGenTierKey,
): Promise<{ url: string | null; changed: boolean }> {
  const res = await api.post<{ url: string | null; changed: boolean }>(
    'billing/checkout/session',
    { package: packageKey, band, ...(tier ? { tier } : {}) },
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
  /** First purchase needs active Lead Gen; later packs can be bought without it. */
  canBuyCredits?: boolean;
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

export async function getCreditLedger(
  limit = 50,
): Promise<CreditLedgerEntry[]> {
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

/** A pack as offered by the auto-recharge endpoint. */
export interface AutoRechargePack {
  key: string;
  label: string;
  credits: number;
  price: number;
}

export type AutoRechargePauseReason = 'PAYMENT_FAILED' | 'MONTHLY_CAP_REACHED';

export type AutoRechargeAttemptStatus = 'SUCCEEDED' | 'FAILED' | 'SKIPPED';

export interface AutoRechargeAttempt {
  id: string;
  status: AutoRechargeAttemptStatus;
  balanceAtTrigger: number;
  packKey: string;
  amountCharged: number | null;
  creditsGranted: number | null;
  failureReason: string | null;
  createdAt: string;
}

/**
 * Auto-recharge settings. `configured: false` means the tenant has never
 * saved settings, so only the pack list comes back -- distinct from
 * configured-but-disabled, which has real values to show.
 */
export interface AutoRechargeSettings {
  configured: boolean;
  enabled?: boolean;
  thresholdCredits?: number;
  packKey?: string;
  monthlyCapAmount?: number | null;
  hasCard?: boolean;
  card?: { brand: string | null; last4: string | null } | null;
  paused?: boolean;
  pauseReason?: AutoRechargePauseReason | null;
  pausedAt?: string | null;
  lastRechargeAt?: string | null;
  monthlySpend?: number;
  packs: AutoRechargePack[];
}

export async function getAutoRecharge(): Promise<AutoRechargeSettings> {
  const res = await api.get<AutoRechargeSettings>(
    'billing/credits/auto-recharge',
  );
  return res.data;
}

export async function updateAutoRecharge(input: {
  enabled: boolean;
  thresholdCredits: number;
  packKey: string;
  monthlyCapAmount: number | null;
}) {
  const res = await api.put<{
    enabled: boolean;
    thresholdCredits: number;
    packKey: string;
    monthlyCapAmount: number | null;
    hasCard: boolean;
  }>('billing/credits/auto-recharge', input);
  return res.data;
}

/**
 * Starts the hosted card-entry flow. This saves a card without charging it:
 * enabling auto-recharge authorises later charges, it is not a purchase.
 */
export async function startAutoRechargeCardSetup(): Promise<{
  url: string | null;
  sessionId: string;
}> {
  const res = await api.post<{ url: string | null; sessionId: string }>(
    'billing/credits/auto-recharge/card/session',
    {},
  );
  return res.data;
}

export async function attachAutoRechargeCard(sessionId: string) {
  const res = await api.post<{
    hasCard: boolean;
    card: { brand: string | null; last4: string | null };
    paused: boolean;
    pauseReason: AutoRechargePauseReason | null;
  }>('billing/credits/auto-recharge/card', { sessionId });
  return res.data;
}

export async function resumeAutoRecharge() {
  const res = await api.post<{ paused: boolean; enabled: boolean }>(
    'billing/credits/auto-recharge/resume',
    {},
  );
  return res.data;
}

export async function getAutoRechargeAttempts(
  limit = 20,
): Promise<AutoRechargeAttempt[]> {
  const res = await api.get<AutoRechargeAttempt[]>(
    'billing/credits/auto-recharge/attempts',
    { params: { limit } },
  );
  return res.data;
}
