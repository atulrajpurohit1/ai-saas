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
