import { AiFeature } from '@prisma/client';

/**
 * Credit price of each AI feature.
 *
 * Credits are one unit across the product: a full Prospect Search is 200, a
 * preview 50. AI features are priced in the same unit so a customer has one
 * balance and one thing to top up, rather than a second currency.
 *
 * ## How these numbers were set
 *
 * At the Pro pack rate (13,000 credits for $249) a credit sells for about
 * $0.019. Measured against Gemini 2.5 Flash list prices ($0.30/M input,
 * $2.50/M output), a typical AI call costs us:
 *
 *   - a short draft  (~2k in / 0.5k out):  ~$0.002  -> ~0.1 credits to break even
 *   - a proposal     (~8k in / 2.5k out):  ~$0.009  -> ~0.5 credits
 *   - an RFP analysis (~40k in / 6k out):  ~$0.027  -> ~1.4 credits
 *
 * So AI calls are one to three orders of magnitude cheaper than a Prospect
 * Search, whose 200 credits sell for about $3.83 against an upstream cost of
 * roughly a dollar. Pricing AI features at search-like numbers would make them
 * absurdly expensive; pricing them at break-even would make them free in
 * practice and leave no margin for the variance.
 *
 * These prices therefore sit at roughly 5-20x our measured cost -- enough that
 * heavy use is paid for and a single large document cannot lose money, while
 * normal use stays cheap enough that nobody counts. The tiers are coarse on
 * purpose: a customer should be able to predict what an action costs before
 * clicking it, which per-token billing does not allow.
 *
 * ## These are a starting point, not a calibration
 *
 * AiUsageEvent records the real cost of every call. Until enough rows exist,
 * the figures above are estimates from published rates and typical prompt
 * sizes, not measurements of this product's actual traffic. Revisit them
 * against `GET /ai/usage/features` -- `averageCostUsd` is the floor, and
 * `maxCostUsd` is what sets the margin risk. Every price is env-overridable so
 * it can be tuned from that data without a deploy.
 */

/** A light call: a short draft or summary from a small prompt. */
const LIGHT = 5;
/** A standard generation: a proposal, guide or assessment. */
const STANDARD = 15;
/** A heavy call: long source documents, or analysis over a whole RFP. */
const HEAVY = 40;

/**
 * Default credit cost per feature.
 *
 * Every AiFeature is listed explicitly, including OTHER, so adding a feature
 * to the enum without pricing it is a compile error rather than a silently
 * free call.
 */
const DEFAULT_AI_CREDIT_COSTS: Record<AiFeature, number> = {
  // --- Heavy: whole documents in the prompt. ---
  [AiFeature.SECURITY_RFP_ANALYSIS]: HEAVY,
  [AiFeature.PROPOSAL_FROM_RFP]: HEAVY,
  [AiFeature.RFP_GENERATION]: HEAVY,
  [AiFeature.EVALUATION_REPORT]: HEAVY,

  // --- Standard: a substantial generated artefact. ---
  [AiFeature.PROPOSAL_DRAFT]: STANDARD,
  [AiFeature.DISCOVERY_PROPOSAL]: STANDARD,
  [AiFeature.LEAD_GENERATION]: STANDARD,
  [AiFeature.DISCOVERY_GUIDE]: STANDARD,
  [AiFeature.OUTREACH_PLAN]: STANDARD,
  [AiFeature.SALES_ASSESSMENT]: STANDARD,
  [AiFeature.DISCOVERY_CALL_INTELLIGENCE]: STANDARD,
  [AiFeature.REVENUE_INTELLIGENCE_SUMMARY]: STANDARD,
  [AiFeature.REVENUE_FINANCIAL_RECOMMENDATIONS]: STANDARD,
  [AiFeature.BUSINESS_INSIGHT_RECOMMENDATIONS]: STANDARD,

  // --- Light: short output, small prompt. ---
  [AiFeature.EMAIL_DRAFT]: LIGHT,
  [AiFeature.NOTE_SUMMARY]: LIGHT,
  [AiFeature.DAILY_REPORT_SUMMARY]: LIGHT,
  [AiFeature.INCIDENT_RISK_SUMMARY]: LIGHT,
  [AiFeature.GUARD_RECOMMENDATION_EXPLANATION]: LIGHT,
  [AiFeature.LEAD_EXTRACTION]: LIGHT,
  [AiFeature.PROSPECT_COMPANY_INSIGHT]: LIGHT,
  [AiFeature.COPILOT_ANSWER]: LIGHT,

  /**
   * Live coaching fires repeatedly during one call, so it is priced per
   * invocation at the cheapest tier -- anything higher would make a single
   * sales call cost more than the deal.
   */
  [AiFeature.DISCOVERY_LIVE_COACH]: 1,

  /**
   * Unmapped actions. Priced at the light tier rather than zero: an
   * unrecognised action is a feature someone forgot to price, and charging
   * nothing for it is the failure mode this table exists to prevent.
   */
  [AiFeature.OTHER]: LIGHT,
};

/**
 * Env override key for a feature, e.g. AI_CREDIT_COST_PROPOSAL_DRAFT.
 * Exported so operators can be told exactly which variable to set.
 */
export function aiCreditCostEnvKey(feature: AiFeature): string {
  return `AI_CREDIT_COST_${feature}`;
}

/**
 * Credit cost of one call to `feature`.
 *
 * A configured value of 0 is honoured, so a feature can be made free
 * deliberately -- but only deliberately, since an unset or malformed variable
 * falls back to the default rather than to zero.
 */
export function aiCreditCost(feature: AiFeature): number {
  const raw = process.env[aiCreditCostEnvKey(feature)];
  if (raw !== undefined && raw.trim() !== '') {
    const parsed = Number(raw);
    if (Number.isInteger(parsed) && parsed >= 0) return parsed;
  }
  return DEFAULT_AI_CREDIT_COSTS[feature];
}

/** Every feature with its current price, for the pricing/settings screen. */
export function aiCreditCostTable(): Array<{
  feature: AiFeature;
  credits: number;
}> {
  return (Object.keys(DEFAULT_AI_CREDIT_COSTS) as AiFeature[]).map(
    (feature) => ({ feature, credits: aiCreditCost(feature) }),
  );
}
