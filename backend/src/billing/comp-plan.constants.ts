import { ServiceModule } from '@prisma/client';
import {
  PACKAGE_KEYS,
  PACKAGE_LABELS,
  PACKAGE_MODULES,
  PackageKey,
} from './pricing.constants';

/**
 * Plans the platform owner can comp a tenant onto.
 *
 * These are the four sellable packages PLUS the Trial plan. The Trial plan is
 * comp-only on purpose: it is free access the owner hands out by name, not
 * something sold through Stripe, so it lives here rather than in
 * pricing.constants -- adding it to the sellable PACKAGE_KEYS would have it
 * sprout Stripe lookup keys and a price table it must never have.
 */
export const TRIAL_PLAN_KEY = 'TRIAL' as const;

export type CompPlanKey = PackageKey | typeof TRIAL_PLAN_KEY;

export const COMP_PLAN_KEYS: CompPlanKey[] = [...PACKAGE_KEYS, TRIAL_PLAN_KEY];

export const COMP_PLAN_LABELS: Record<CompPlanKey, string> = {
  ...PACKAGE_LABELS,
  [TRIAL_PLAN_KEY]: 'AegisLead Trial Plan',
};

/**
 * Which service modules each comp plan unlocks.
 *
 * The Trial plan unlocks every module -- the whole product. It is NOT the AI
 * switch: a Trial tenant gets all the non-AI features of all three modules and
 * is denied only the Gemini features, which `compPlanAiEnabled` turns off. The
 * module list cannot do that itself, because each module carries both AI and
 * non-AI features.
 */
export const COMP_PLAN_MODULES: Record<CompPlanKey, ServiceModule[]> = {
  ...PACKAGE_MODULES,
  [TRIAL_PLAN_KEY]: [
    ServiceModule.LEAD_GEN,
    ServiceModule.GUARD_TOUR,
    ServiceModule.FINANCE,
  ],
};

/**
 * Whether a comp plan includes the AI (Gemini) features. Every plan does
 * except the Trial plan, whose entire point is to withhold them.
 */
export function compPlanAiEnabled(plan: CompPlanKey): boolean {
  return plan !== TRIAL_PLAN_KEY;
}

export function isCompPlanKey(value: string): value is CompPlanKey {
  return (COMP_PLAN_KEYS as string[]).includes(value);
}

/**
 * Which plan a comped subscription row is on.
 *
 * Reads the recorded plan first, because that is the only thing that actually
 * knows: the module rows cannot tell Trial from Complete (both unlock all
 * three services), which is how a Trial tenant came to be shown "AegisLead
 * Complete".
 *
 * Falls back to AI-off-means-Trial for rows comped before `compPlan` existed
 * and missed by the backfill. That inference is kept only as a fallback: it
 * holds only while Trial is the single plan without AI, so nothing new should
 * depend on it.
 *
 * Returns null when the plan is genuinely unknown -- a revoked legacy comp,
 * say -- and callers show the modules instead of inventing a name.
 */
export function compPlanOf(subscription: {
  compPlan?: string | null;
  aiEnabled?: boolean | null;
}): CompPlanKey | null {
  const recorded = subscription.compPlan;
  if (recorded && isCompPlanKey(recorded)) return recorded;
  if (subscription.aiEnabled === false) return TRIAL_PLAN_KEY;
  return null;
}
