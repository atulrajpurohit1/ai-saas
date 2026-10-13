/**
 * Raised when BlackPearl refuses to start a job because a spending limit has
 * been reached, rather than because anything went wrong.
 *
 * This is deliberately NOT an HttpException. The providers are the boundary to
 * a third party and know nothing about our customers; translating an upstream
 * budget stop into a customer-facing status is the service's job, since the
 * right answer depends on whose budget ran out. Keeping that decision out of
 * the provider also keeps the providers testable without Nest's HTTP layer.
 *
 * `scope` says who is affected, which is the whole reason the distinction
 * matters operationally:
 *
 *   - 'company' - a company-wide stop: our prepaid balance is spent, or a
 *                 budget or quota on our one shared project refused the job.
 *                 EVERY tenant is stopped and only we can fix it, so this
 *                 must page an operator rather than ask the customer for
 *                 money. Every code in BLACKPEARL_TERMINAL_BUDGET_CODES maps
 *                 here today.
 *   - 'tenant'  - one tenant's own upstream allowance. NOTHING produces this
 *                 yet: it would need a BlackPearl project per tenant, and
 *                 their keys are project-scoped, so that means one key per
 *                 tenant minted through their console. The scope is kept
 *                 because the distinction is the whole point of the type --
 *                 who to tell, and whether money from the customer fixes it.
 *                 The per-tenant ceiling that DOES exist is enforced from our
 *                 own ledger in UpstreamBudgetService, before we ever submit.
 */
export class UpstreamBudgetExceededError extends Error {
  constructor(
    /** BlackPearl's own `error.code`, kept verbatim for the logs. */
    public readonly code: string,
    public readonly scope: 'tenant' | 'company',
  ) {
    super(`BlackPearl refused the job: ${code} (scope=${scope})`);
    this.name = 'UpstreamBudgetExceededError';
  }
}
