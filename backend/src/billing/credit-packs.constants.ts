/**
 * Prospect Search credit packs.
 *
 * One credit buys one unit of BlackPearl work: one prospect returned by a
 * discovery search, or one single-company playbook.
 *
 * PLACEHOLDER PRICING -- NOT CONFIRMED WITH BLACKPEARL OR THE CLIENT.
 *
 * Earlier revisions of this file stated a unit cost of "~$0.11 per prospect,
 * confirmed empirically". That figure was never measured against a real
 * BlackPearl account and no source for it exists; it should not be relied on
 * in a pricing conversation. The per-prospect billing MODEL is also an
 * assumption: BlackPearl's own API describes prepaid credit in USD
 * (PublicCredits.balance_usd) with per-job usage reported in tokens and
 * compute (PublicJobUsage: input_tokens, output_tokens, cost_usd), plus
 * request-metered quotas -- none of which is a per-prospect charge.
 *
 * Before these numbers back any external commitment, get real figures from
 * BlackPearl's /v1/usage endpoint on our own API key after live runs, or a
 * rate card from them directly, and replace this block with the source.
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
 * is conventional. Whether the margin is adequate is UNKNOWN until the real
 * BlackPearl unit cost is established -- see the note above.
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
