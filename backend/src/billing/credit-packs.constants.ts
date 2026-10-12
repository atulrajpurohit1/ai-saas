/**
 * Prospect Search credit packs.
 *
 * One credit buys one unit of BlackPearl work: one prospect returned by a
 * discovery search, or one single-company playbook.
 *
 * PRICES BELOW ARE A KNOWN LOSS ON PLAYBOOKS. See "Measured costs" below.
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
 * ## Measured costs (12 Oct 2026)
 *
 * Two independent sources now agree, so the margin is no longer unknown:
 *
 * 1. `GET /v1/pricing-estimates` on our own live key -- BlackPearl's published
 *    typical price at OUR rates:
 *      playbooks  ~$5.70 per playbook  (10th-90th pct $4.00 - $12.00)
 *      documents  ~$1.40 per document  ($0.92 - $1.40)
 *      brands     ~$0.14 per brand     ($0.10 - $0.20)
 *    No `prospecting` estimate is published for us yet -- that capability is
 *    enabled, but the endpoint omits anything without enough recent runs.
 *
 * 2. Our own CreditLedgerEntry.upstreamCostUsd rows (real `job_*` jobs only;
 *    the `demo-job-*` rows are seeded fiction and must be excluded):
 *      discovery (4 jobs, preview-priced)  $0.67 - $1.47, median $0.95
 *      playbook  (1 job)                   $3.74
 *
 * ## What that means
 *
 * At 50 credits, a playbook sells for $2.48 (Starter), $0.96 (Pro) or $0.76
 * (Elite). Against even our single cheapest observed playbook at $3.74 --
 * itself below BlackPearl's own ~$5.70 typical -- EVERY pack loses money on
 * EVERY playbook. Breaking even at ~$5.70 would need roughly 115 credits on
 * Starter, 298 on Pro and 376 on Elite, and ~2x those at the $12.00 top of
 * the published range.
 *
 * Discovery is the healthier half and is only safe on Starter: at 50 credits
 * it clears a $0.95 median by $1.54 on Starter, $0.01 on Pro and LOSES $0.19
 * on Elite. Note all four measured discovery runs were preview-sized; a full
 * search at 200 credits has no measured cost behind it at all.
 *
 * This is a pricing decision, not a code one, so the numbers here are left as
 * the client set them and the loss is documented rather than silently
 * "corrected". Raising PROSPECT_PLAYBOOK_CREDIT_COST is possible without a
 * deploy (see the env vars below) if the call is to stop the bleeding first.
 * Re-run `scripts/report-search-margin.ts` as more real rows accumulate.
 *
 * As with subscription pricing, the amounts here are list price for display and
 * for picking the right Stripe price id -- Stripe remains the source of truth
 * for what is actually charged.
 */

export type CreditPackKey = 'STARTER' | 'PRO' | 'ELITE';

export interface CreditPack {
  key: CreditPackKey;
  label: string;
  credits: number;
  /** List price in whole currency units. */
  price: number;
}

/**
 * Pack sizes and prices, set by the client on 1 Oct 2026 against Bebop's
 * published tiers: the same price points, with 2,000 fewer credits in each
 * ($149/5,000, $249/15,000 and $349/25,000 there). Credits are sized in the
 * same units as Bebop's -- see the per-search costs below -- so the comparison
 * holds per search, not just per credit.
 *
 * One-time purchases, not monthly: renewal was deferred so launch could use the
 * existing purchase, refund and dispute handling unchanged.
 *
 * Whether the margin is adequate is still UNKNOWN until the real BlackPearl
 * cost per search is established -- see the note above.
 */
export const CREDIT_PACKS: Record<CreditPackKey, CreditPack> = {
  STARTER: { key: 'STARTER', label: 'Starter Pack', credits: 3000, price: 149 },
  PRO: { key: 'PRO', label: 'Pro Pack', credits: 13000, price: 249 },
  ELITE: { key: 'ELITE', label: 'Elite Pack', credits: 23000, price: 349 },
};

export const CREDIT_PACK_KEYS = Object.keys(CREDIT_PACKS) as CreditPackKey[];

export function isCreditPackKey(value: string): value is CreditPackKey {
  return Object.prototype.hasOwnProperty.call(CREDIT_PACKS, value);
}

/**
 * What each kind of search costs the customer, as a FLAT price per search.
 *
 * Discovery used to be charged per prospect returned: the hold was the
 * requested limit and settlement charged `prospects.length`, refunding the
 * rest. That was backwards. BlackPearl bills for AI compute, and a search that
 * returns few prospects is a HARD search, which burns more compute than an
 * easy one. So the old model refunded the customer most precisely when the
 * search had cost us most -- revenue fell as cost rose.
 *
 * A flat per-search price breaks that link. It is also what the customer can
 * actually reason about: they know the price before they run it, and it does
 * not change based on how many results the AI happened to find.
 *
 * Sized in Bebop's units, as the client set them: about 200 credits for a full
 * search and 50 for a preview. Discovery has both modes in the UI -- Preview
 * asks for up to PREVIEW_RESULT_LIMIT prospects, Full for more -- so its price
 * follows the limit requested. A single-company playbook is priced like a
 * preview. Pack sizes above only compare fairly with Bebop's because of this.
 *
 * Now calibrated, and the playbook price is a confirmed loss at every pack
 * size -- see "Measured costs" at the top of this file. Both are overridable
 * by env var so they can be tuned without a deploy.
 */
const DEFAULT_PLAYBOOK_CREDIT_COST = 50;
const DEFAULT_DISCOVERY_CREDIT_COST = 200;
const DEFAULT_PREVIEW_DISCOVERY_CREDIT_COST = 50;

/**
 * The largest result limit still charged as a preview. Matches the UI's
 * Preview preset; anything above it, or no limit at all, is a full search.
 */
export const PREVIEW_RESULT_LIMIT = 5;

function creditCostFromEnv(key: string, fallback: number): number {
  const configured = Number(process.env[key]);
  return Number.isInteger(configured) && configured > 0 ? configured : fallback;
}

/** Credits charged for one single-company playbook. */
export function playbookCreditCost(): number {
  return creditCostFromEnv(
    'PROSPECT_PLAYBOOK_CREDIT_COST',
    DEFAULT_PLAYBOOK_CREDIT_COST,
  );
}

/**
 * Credits charged for one discovery search, whatever it returns -- including
 * when it returns nothing, because an empty result still costs us a full job
 * upstream. A search that FAILS is still refunded in full; that is a different
 * case from one that succeeded and found nobody.
 *
 * Priced from the limit the request actually carries, never from which button
 * the UI showed: a request asking for PREVIEW_RESULT_LIMIT or fewer is a
 * preview, anything else -- including no limit, which the provider treats as
 * its own default of 10 -- is a full search.
 */
export function discoveryCreditCost(limit?: number): number {
  return limit !== undefined && limit <= PREVIEW_RESULT_LIMIT
    ? previewDiscoveryCreditCost()
    : fullDiscoveryCreditCost();
}

/** Credits for a full discovery search. */
export function fullDiscoveryCreditCost(): number {
  return creditCostFromEnv(
    'PROSPECT_DISCOVERY_CREDIT_COST',
    DEFAULT_DISCOVERY_CREDIT_COST,
  );
}

/** Credits for a preview discovery search (limit <= PREVIEW_RESULT_LIMIT). */
export function previewDiscoveryCreditCost(): number {
  return creditCostFromEnv(
    'PROSPECT_PREVIEW_CREDIT_COST',
    DEFAULT_PREVIEW_DISCOVERY_CREDIT_COST,
  );
}

/**
 * Credits every new account starts with, so a customer can try Prospect Search
 * before buying a pack: one preview search or one playbook, not a full search.
 * Spendable only once the tenant owns Lead Gen, since credits are gated on it.
 */
const DEFAULT_SIGNUP_CREDIT_GRANT = 50;

export function signupCreditGrant(): number {
  return creditCostFromEnv('SIGNUP_CREDIT_GRANT', DEFAULT_SIGNUP_CREDIT_GRANT);
}

/**
 * Stripe price id env var for a pack, e.g. STRIPE_PRICE_CREDITS_PRO.
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
