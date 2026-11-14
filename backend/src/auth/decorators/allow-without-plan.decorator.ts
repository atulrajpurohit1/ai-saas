import { SetMetadata } from '@nestjs/common';

export const ALLOW_WITHOUT_PLAN_KEY = 'allow_without_plan';

/**
 * Exempts a controller or route from PlanGuard, which otherwise refuses every
 * request from a tenant with no active plan.
 *
 * The exemption list is deliberately tiny and must stay that way: it exists
 * only so a tenant with no plan can still SIGN IN, SEE that it needs a plan,
 * and BUY one. Anything beyond that is a product feature and must be paid for.
 *
 * Adding this to a route that serves tenant business data gives that data away
 * for free, so each use carries a comment saying why it is not a feature.
 */
export const AllowWithoutPlan = () => SetMetadata(ALLOW_WITHOUT_PLAN_KEY, true);
