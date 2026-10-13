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
 *   - 'tenant'  - one client's own allowance, daily/monthly limit, or the
 *                 minimum needed to start a search. Every other tenant keeps
 *                 working, and the tenant should be told to top up.
 *   - 'company' - our own prepaid balance with BlackPearl is spent. EVERY
 *                 tenant is stopped and only we can fix it, so this must page
 *                 an operator rather than ask the customer for money. Note
 *                 that per-client projects do NOT fix this one: the company
 *                 balance funds every project.
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
