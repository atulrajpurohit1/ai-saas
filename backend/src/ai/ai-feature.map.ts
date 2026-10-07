import { AiFeature } from '@prisma/client';

/**
 * Maps the free-text `action` label each AI call already passes for logging
 * onto the AiFeature enum that usage is grouped by.
 *
 * The action strings existed first, purely for error messages, and are
 * reused here rather than threading a second parameter through 23 call
 * sites. The coupling is the cost of that: renaming an action label silently
 * demotes its usage rows to OTHER, which is why resolveAiFeature falls back
 * loudly rather than guessing.
 */
const EXACT: Record<string, AiFeature> = {
  'daily report summary generation': AiFeature.DAILY_REPORT_SUMMARY,
  'sales assessment generation': AiFeature.SALES_ASSESSMENT,
  'discovery guide generation': AiFeature.DISCOVERY_GUIDE,
  'outreach plan generation': AiFeature.OUTREACH_PLAN,
  'discovery call intelligence generation':
    AiFeature.DISCOVERY_CALL_INTELLIGENCE,
  'discovery live coaching generation': AiFeature.DISCOVERY_LIVE_COACH,
  'discovery-based proposal generation': AiFeature.DISCOVERY_PROPOSAL,
  'proposal draft generation': AiFeature.PROPOSAL_DRAFT,
  'RFP generation': AiFeature.RFP_GENERATION,
  'proposal evaluation generation': AiFeature.EVALUATION_REPORT,
  'security RFP requirement analysis': AiFeature.SECURITY_RFP_ANALYSIS,
  'RFP-grounded proposal generation': AiFeature.PROPOSAL_FROM_RFP,
  'email draft generation': AiFeature.EMAIL_DRAFT,
  'notes summarization': AiFeature.NOTE_SUMMARY,
  'business insight recommendations': AiFeature.BUSINESS_INSIGHT_RECOMMENDATIONS,
  'incident risk summary': AiFeature.INCIDENT_RISK_SUMMARY,
  'revenue intelligence summary': AiFeature.REVENUE_INTELLIGENCE_SUMMARY,
  'revenue financial recommendations':
    AiFeature.REVENUE_FINANCIAL_RECOMMENDATIONS,
  'guard recommendation explanation':
    AiFeature.GUARD_RECOMMENDATION_EXPLANATION,
  'copilot answer': AiFeature.COPILOT_ANSWER,
  'lead extraction': AiFeature.LEAD_EXTRACTION,
  'prospect company insight': AiFeature.PROSPECT_COMPANY_INSIGHT,
};

/**
 * Prefix rules, for actions whose label embeds an id -- e.g.
 * `proposal generation for lead abc-123`, which can never match exactly.
 */
const PREFIXES: Array<[string, AiFeature]> = [
  ['proposal generation for lead', AiFeature.LEAD_GENERATION],
];

export const AI_FEATURE_BY_ACTION = EXACT;

/**
 * The feature an action label belongs to, or OTHER when unrecognised.
 *
 * OTHER is a real outcome, not an error: an action added without a map entry
 * still gets its cost recorded, under a bucket whose growth signals the
 * omission. Losing the row would be worse than filing it imprecisely.
 */
export function resolveAiFeature(action: string): AiFeature {
  const exact = EXACT[action];
  if (exact) return exact;

  const normalized = action.toLowerCase();
  for (const [prefix, feature] of PREFIXES) {
    if (normalized.startsWith(prefix.toLowerCase())) return feature;
  }

  return AiFeature.OTHER;
}
