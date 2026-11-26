import { SetMetadata } from '@nestjs/common';

export const ALLOW_WITHOUT_PLAN_KEY = 'allow_without_plan';

/**
 * Exempts a controller or route from PlanGuard, which otherwise refuses every
 * request from a tenant with no active plan.
 *
 * The exemption list is deliberately tiny and must stay that way: it exists
 * so a tenant with no plan can still sign in, see pricing and buy a plan.
 * Prospect Search is also exempt because its work is charged to the credit
 * ledger; read-only credit balance routes support that exception.
 *
 * Each use must have its own authorization and billing gate.
 */
export const AllowWithoutPlan = () => SetMetadata(ALLOW_WITHOUT_PLAN_KEY, true);
