/**
 * Prospect Search credit packs.
 *
 * One credit buys one unit of BlackPearl work: one prospect returned by a
 * discovery search, or one single-company playbook. That mapping is deliberate
 * -- BlackPearl bills us per prospect (~$0.11 confirmed empirically, see
 * ProspectDiscoveryCacheService), so pricing credits in the same unit keeps the
 * margin on every pack fixed instead of swinging with result counts.
 *
 * As with subscription pricing, the amounts here are list price for display and
 * for picking the right Stripe price id -- Stripe remains the source of truth
 * for what is actually charged.
 */

export type CreditPackKey = 'STARTER' | 'GROWTH' | 'SCALE';

export interface CreditPack {
  key: CreditPackKey;
  label: string;
  credits: number;
  /** List price in whole currency units. */
  price: number;
}

/**
 * Pack sizes and prices. The per-credit rate falls as packs get larger, which
 * is both conventional and safe: even the cheapest rate here sits well above
 * the ~$0.11 unit cost.
 */
export const CREDIT_PACKS: Record<CreditPackKey, CreditPack> = {
  STARTER: { key: 'STARTER', label: 'Starter Pack', credits: 250, price: 99 },
  GROWTH: { key: 'GROWTH', label: 'Growth Pack', credits: 1000, price: 299 },
  SCALE: { key: 'SCALE', label: 'Scale Pack', credits: 5000, price: 1199 },
};

export const CREDIT_PACK_KEYS = Object.keys(CREDIT_PACKS) as CreditPackKey[];

export function isCreditPackKey(value: string): value is CreditPackKey {
  return Object.prototype.hasOwnProperty.call(CREDIT_PACKS, value);
}

/**
 * How many credits a playbook costs. A single-company playbook is one unit of
 * BlackPearl work regardless of how much it returns.
 */
export const PLAYBOOK_CREDIT_COST = 1;

/**
 * Stripe price id env var for a pack, e.g. STRIPE_PRICE_CREDITS_GROWTH.
 * Unset means that pack cannot be sold and checkout answers 503 for it,
 * matching how subscription prices behave before the client supplies them.
 */
export function creditPackPriceEnvKey(pack: CreditPackKey) {
  return `STRIPE_PRICE_CREDITS_${pack}`;
}

export function creditPackPriceId(pack: CreditPackKey): string | null {
  return process.env[creditPackPriceEnvKey(pack)]?.trim() || null;
}

/**
 * Resolves a Stripe price id back to the pack it sells. Used by the webhook,
 * which must never trust the credit amount in session metadata -- metadata is
 * editable in the Dashboard, so the price id is the only trustworthy statement
 * of what was bought.
 */
export function creditPackForPriceId(priceId: string): CreditPack | null {
  for (const pack of CREDIT_PACK_KEYS) {
    if (creditPackPriceId(pack) === priceId) return CREDIT_PACKS[pack];
  }
  return null;
}

/** Packs that have a Stripe price configured and can be sold today. */
export function sellableCreditPacks(): CreditPack[] {
  return CREDIT_PACK_KEYS.map((key) => CREDIT_PACKS[key]).filter((pack) =>
    creditPackPriceId(pack.key),
  );
}
