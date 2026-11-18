/**
 * AegisLead Generation (Lead Gen) plans.
 *
 * Lead Gen is the one package that is NOT priced by guard count. It is a sales
 * tool: a company with four guards and a company with four hundred run the
 * same prospecting workload, and a Lead Gen customer may not track guards in
 * this system at all. Charging them more for guards they do not use here was
 * never defensible, so Lead Gen leaves the guard-band table entirely.
 *
 * There are two ways to be on Lead Gen:
 *
 *  - A STARTING PLAN (Starter, Pro, Elite). The price is the flat platform fee
 *    plus a credit allocation, and the credits are handed over ONCE, when the
 *    plan is bought. This is the only way in: a tenant that has never held
 *    Lead Gen must buy one of these, so nobody starts with an empty balance
 *    and a product they cannot use.
 *  - The BASE plan, at the platform fee alone and with no credits. Open only
 *    to a tenant that has held Lead Gen before, for whom the starting credits
 *    are a question already settled. More credits are bought from the credits
 *    page whenever they are wanted.
 *
 * Credits DO NOT expire and DO NOT reset. The balance is a ledger that only
 * moves when somebody spends it, so an allocation sits there until it is used.
 * Nothing here is a monthly allowance -- the plan is what recurs, not the
 * credits -- which is why renewals grant nothing: see
 * StripeWebhookService.onInvoicePaid, which only ever pays out on the invoice
 * that STARTS a subscription.
 *
 * Credit sizes and prices match the one-time packs in
 * credit-packs.constants.ts today, deliberately, so the credits bundled with a
 * plan and the credits bought as a top-up are the same units at the same
 * price. They are defined separately because either can be repriced without
 * the other.
 *
 * As everywhere else in billing, these amounts are the published list price,
 * used for display and for picking the right Stripe price -- Stripe remains
 * the source of truth for what is actually charged.
 */

export type LeadGenTierKey = 'STARTER' | 'PRO' | 'ELITE';

/**
 * The platform fee every Lead Gen plan pays, with or without credits.
 * Unchanged from the flat Generation price the client confirmed on 1 Oct 2026,
 * and still sold under the Generation base-band price -- so a tenant already
 * on the old $299 Generation plan is, by definition, on the base plan.
 */
export const LEAD_GEN_BASE_PRICE = 299;

export interface LeadGenTier {
  key: LeadGenTierKey;
  /** Shown as the card title: "Starter", not "AegisLead Generation Starter". */
  name: string;
  tagline: string;
  /** Credits handed over once, when the plan starts. They never expire. */
  includedCredits: number;
  /** The part of the price that buys those credits. */
  creditsPrice: number;
  /** Monthly list price: LEAD_GEN_BASE_PRICE + creditsPrice. */
  price: number;
  /** Exactly one tier is highlighted on the pricing cards. */
  popular: boolean;
}

function tier(
  key: LeadGenTierKey,
  name: string,
  tagline: string,
  includedCredits: number,
  creditsPrice: number,
  popular = false,
): LeadGenTier {
  return {
    key,
    name,
    tagline,
    includedCredits,
    creditsPrice,
    price: LEAD_GEN_BASE_PRICE + creditsPrice,
    popular,
  };
}

export const LEAD_GEN_TIERS: Record<LeadGenTierKey, LeadGenTier> = {
  STARTER: tier(
    'STARTER',
    'Starter',
    'For growing security companies initiating targeted outreach',
    3_000,
    149,
  ),
  PRO: tier(
    'PRO',
    'Pro',
    'For active business development teams scaling commercial contracts',
    13_000,
    249,
    true,
  ),
  ELITE: tier(
    'ELITE',
    'Elite',
    'For regional and enterprise firms demanding high-velocity pipeline',
    23_000,
    349,
  ),
};

export const LEAD_GEN_TIER_KEYS = Object.keys(
  LEAD_GEN_TIERS,
) as LeadGenTierKey[];

/** The package every Lead Gen plan sells, for the entitlement it grants. */
export const LEAD_GEN_PACKAGE_LABEL = 'AegisLead Generation';

export function isLeadGenTierKey(value: string): value is LeadGenTierKey {
  // Membership of the key list, not `in`: `in` would accept inherited names
  // like "toString" as a tier.
  return (LEAD_GEN_TIER_KEYS as string[]).includes(value);
}

/**
 * The Stripe lookup_key for a starting plan's monthly price, e.g.
 * `aegislead_leadgen_pro_13000cr_548usd_monthly`.
 *
 * Both the credit count and the amount are part of the key, for the same
 * reason they are in the plan keys: changing either resolves to a NEW Stripe
 * price rather than quietly reusing the old one, so a customer can never end
 * up paying last month's price for this month's credits, or the other way
 * round.
 */
export function leadGenTierLookupKey(key: LeadGenTierKey): string {
  const tierDef = LEAD_GEN_TIERS[key];
  return `aegislead_leadgen_${key.toLowerCase()}_${tierDef.includedCredits}cr_${tierDef.price}usd_monthly`;
}

export function allLeadGenTierLookupKeys(): string[] {
  return LEAD_GEN_TIER_KEYS.map(leadGenTierLookupKey);
}

/**
 * Reverses leadGenTierLookupKey. The webhook uses this to work out what a
 * subscription actually pays for -- and how many credits it owes on the
 * invoice that starts it -- from the price Stripe reports, never from
 * metadata.
 */
export function leadGenTierForLookupKey(
  lookupKey: string | null | undefined,
): LeadGenTier | null {
  if (!lookupKey) return null;
  for (const key of LEAD_GEN_TIER_KEYS) {
    if (leadGenTierLookupKey(key) === lookupKey) return LEAD_GEN_TIERS[key];
  }
  return null;
}

/**
 * The handle a plan's credit grant is recorded under, so a refund of that
 * invoice can take the credits back.
 */
export function leadGenCreditsKey(invoiceId: string): string {
  return `leadgen-credits:${invoiceId}`;
}

/**
 * What makes a plan's credits a ONE-TIME grant: one payout per subscription
 * per tier, enforced by the ledger's unique index rather than by a read.
 *
 * Keyed on the subscription and not the invoice, because the invoice says
 * nothing useful about whether these credits are owed. A renewal invoice
 * carries the same tier line as the purchase did, and a customer adding Lead
 * Gen to an existing plan gets a mid-cycle proration rather than a new
 * subscription -- so filtering on the invoice's billing reason either pays
 * out every month or never pays out the add-on at all.
 *
 * What this key allows and refuses:
 *  - First payment for a tier: granted.
 *  - Every renewal after it: refused, which is what "credits do not refill"
 *    means.
 *  - Starter upgraded to Pro: granted, because Pro's credits were never paid
 *    for on this subscription.
 *  - Pro to Starter and back to Pro: refused, so switching cannot mint.
 *  - Cancelled, then subscribed again later: granted, because that is a new
 *    subscription and a new purchase.
 */
export function leadGenPurchaseKey(
  subscriptionId: string,
  tier: LeadGenTierKey,
): string {
  return `leadgen:${subscriptionId}:${tier.toLowerCase()}`;
}
