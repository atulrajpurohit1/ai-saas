import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UpstreamSpendCapExceededException } from '../billing/upstream-spend-cap.exception';
import {
  BlackPearlProspectingProvider,
  UpstreamBudgetSnapshot,
} from './providers/blackpearl-prospecting.provider';

/**
 * Decides whether upstream BlackPearl spend is allowed -- globally, and per
 * tenant.
 *
 * AegisLead is not on a BlackPearl plan with a monthly allowance; it runs on a
 * one-off prepaid grant held at the ORGANIZATION level. BlackPearl's own API
 * is explicit about that scope: `credits.balance_usd` on GET /v1/usage is
 * described as the organization's balance, and a 402 from a job submission is
 * "the organization does not have enough prepaid credits". That gave this
 * system two separate problems:
 *
 *   1. There is no overage. When the pot reaches zero, Prospect Search stops
 *      working for every tenant at once. Nothing degrades gracefully.
 *   2. A single tenant can consume the whole pot. Customer credits are sold
 *      at a flat price per search, but our cost per search is set by
 *      BlackPearl's compute and varies by roughly an order of magnitude, so a
 *      handful of expensive searches can drain far more than their sale price
 *      suggests.
 *
 * Only (1) is genuinely global, and it stays a 503: no customer action fixes
 * an empty shared pot, so refusing everyone is the honest answer. (2) is a
 * per-tenant problem and now has a per-tenant answer -- assertTenantCanSpend()
 * caps what any one tenant may cost us in a month, and refuses that tenant
 * alone rather than taking the whole platform down with them.
 *
 * Note what this does NOT do: it does not ask BlackPearl to enforce anything
 * per tenant. Their per-project budgets could do that, but a BlackPearl API
 * key is project-scoped -- the project is chosen by WHICH key you send, not by
 * a header -- so per-tenant projects would mean one key per tenant, minted
 * through their console. Until that exists, the per-tenant ceiling is enforced
 * here, from our own ledger, which is the only place that knows which tenant
 * a given job's cost belongs to.
 *
 * The upstream figures are cached briefly: they only move when we spend, and a
 * remote call on the path of every search would add latency to the thing we
 * are trying to protect.
 */

/** How long a fetched snapshot is trusted before being re-read. */
const BALANCE_CACHE_MS = 60_000;

/**
 * Default USD floor below which new billed jobs are refused. Held back so
 * in-flight jobs can settle, and so the account does not hit exactly zero --
 * which is where behaviour is least predictable.
 */
const DEFAULT_RESERVE_FLOOR_USD = 25;

/** Warn at this multiple of the floor, while there is still time to act. */
const WARNING_FLOOR_MULTIPLE = 4;

/** Warn once a tenant has used this share of its monthly cap. */
const TENANT_CAP_WARNING_SHARE = 0.8;

@Injectable()
export class UpstreamBudgetService {
  private readonly logger = new Logger(UpstreamBudgetService.name);
  private cached: {
    snapshot: UpstreamBudgetSnapshot;
    fetchedAt: number;
  } | null = null;
  /**
   * Last snapshot we successfully read, kept even once the cache is expired or
   * invalidated. A stale figure is far more useful than none: null means
   * "unknown", and assertCanSpend deliberately allows spending when the figure
   * is unknown, so losing the last known value would silently disable the
   * guard exactly when BlackPearl is having trouble.
   */
  private lastKnown: UpstreamBudgetSnapshot | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly provider: BlackPearlProspectingProvider,
  ) {}

  private reserveFloorUsd(): number {
    const configured = Number(
      this.configService.get<string>('BLACKPEARL_RESERVE_FLOOR_USD'),
    );
    return Number.isFinite(configured) && configured >= 0
      ? configured
      : DEFAULT_RESERVE_FLOOR_USD;
  }

  /**
   * The most a single tenant may cost us upstream in one calendar month, in
   * USD, or null when no cap is configured.
   *
   * There is deliberately NO default. A cap has to be set from what a search
   * actually costs us, and that figure is not yet established -- see the note
   * at the top of credit-packs.constants.ts, and scripts/report-search-margin.ts
   * which measures it from real settled jobs. Inventing a number here would
   * either be too loose to cap anything or would start refusing paying
   * customers mid-month. Until one is set, this service still records what
   * each tenant is costing us on every check, so the figure can be chosen
   * from data rather than guessed.
   */
  private tenantMonthlyCapUsd(): number | null {
    const raw = this.configService.get<string>(
      'BLACKPEARL_TENANT_MONTHLY_COST_CAP_USD',
    );
    if (raw === undefined || raw === null || `${raw}`.trim() === '')
      return null;

    const configured = Number(raw);
    if (!Number.isFinite(configured) || configured <= 0) {
      this.logger.warn(
        `BLACKPEARL_TENANT_MONTHLY_COST_CAP_USD is set to "${raw}", which is not a positive number. No per-tenant cap will be enforced.`,
      );
      return null;
    }
    return configured;
  }

  /**
   * Current upstream spending room, or null when it cannot be determined.
   * `force` skips the cache, for an admin-facing read where staleness would be
   * misleading.
   */
  async getSnapshot(force = false): Promise<UpstreamBudgetSnapshot | null> {
    const now = Date.now();

    if (
      !force &&
      this.cached &&
      now - this.cached.fetchedAt < BALANCE_CACHE_MS
    ) {
      return this.cached.snapshot;
    }

    const snapshot = await this.provider.getUpstreamStatus();

    if (!snapshot) {
      // The read itself failed (no key, or HTTP failure after retries). Fall
      // back to the last figure we actually saw rather than to null: a
      // slightly stale figure still enforces the floor, where null switches
      // the guard off entirely.
      this.logger.warn(
        'Could not read BlackPearl usage; falling back to the last known figures.',
      );
      return this.lastKnown;
    }

    this.cached = { snapshot, fetchedAt: now };
    this.lastKnown = snapshot;
    return snapshot;
  }

  /**
   * Current organization-wide prepaid balance in USD, or null when unknown.
   * Kept as a named accessor because "what is left in the pot" is the one
   * figure an operator asks for directly.
   */
  async getBalanceUsd(force = false): Promise<number | null> {
    const snapshot = await this.getSnapshot(force);
    return snapshot?.prepaidBalanceUsd ?? null;
  }

  /**
   * Throws 503 when there is not enough room upstream to start new billed
   * work, for anyone.
   *
   * The binding constraint is whichever is closest: the prepaid pot, or the
   * tightest HARD budget BlackPearl reports. Previously only the pot was
   * checked, so a hard budget could refuse a job at zero remaining while this
   * guard still reported everything healthy.
   *
   * Deliberately fails OPEN when nothing can be determined (BlackPearl
   * unreachable, or an account that reports neither a prepaid balance nor a
   * budget): an unknown figure is not evidence of an empty one, and refusing
   * every search because a status endpoint is down would turn a monitoring
   * problem into an outage. The exhausted case is caught by BlackPearl's own
   * error anyway; this guard exists to catch it earlier and more cheaply, not
   * as the only line.
   */
  async assertCanSpend(): Promise<void> {
    const snapshot = await this.getSnapshot();
    if (!snapshot) return;

    const remainingUsd = bindingRemainingUsd(snapshot);
    if (remainingUsd === null) return;

    const floor = this.reserveFloorUsd();
    const where = describeConstraint(snapshot);

    if (remainingUsd <= floor) {
      this.logger.error(
        `BlackPearl spending room is $${remainingUsd.toFixed(
          2,
        )} (${where}), at or below the $${floor.toFixed(
          2,
        )} reserve floor. Refusing new Prospect Search jobs for every tenant.`,
      );
      throw new ServiceUnavailableException(
        'Prospect Search is temporarily unavailable. Please try again later or contact support.',
      );
    }

    // Warn while there is still time to act, rather than only at the floor.
    if (remainingUsd <= floor * WARNING_FLOOR_MULTIPLE) {
      this.logger.warn(
        `BlackPearl spending room is low: $${remainingUsd.toFixed(
          2,
        )} remaining (${where}, floor $${floor.toFixed(2)}).`,
      );
    }
  }

  /**
   * Throws 429 when THIS tenant has already cost us more upstream this month
   * than their cap allows, and records what they have cost us either way.
   *
   * `monthToDateCostUsd` is the tenant's own share of our upstream bill, summed
   * from the ledger by the caller -- our ledger is the only record that ties a
   * BlackPearl job's reported cost to the tenant that ran it.
   *
   * This is the per-tenant replacement for refusing everyone at a global
   * floor. A tenant over their cap is turned away on their own; every other
   * tenant keeps searching.
   */
  assertTenantCanSpend(tenantId: string, monthToDateCostUsd: number): void {
    const cap = this.tenantMonthlyCapUsd();

    if (cap === null) {
      // Visibility even with no cap set: this is the figure a cap should be
      // chosen from, and without it a tenant draining the pot is only
      // discoverable after the pot is gone.
      this.logger.log(
        `Tenant ${tenantId} has cost $${monthToDateCostUsd.toFixed(
          2,
        )} upstream this month (no per-tenant cap configured).`,
      );
      return;
    }

    if (monthToDateCostUsd >= cap) {
      const resetsAt = nextMonthStartUtc().toISOString();
      this.logger.error(
        `Tenant ${tenantId} has cost $${monthToDateCostUsd.toFixed(
          2,
        )} upstream this month, at or above their $${cap.toFixed(
          2,
        )} cap. Refusing further Prospect Search jobs for this tenant until ${resetsAt}.`,
      );
      throw new UpstreamSpendCapExceededException(
        'This account has reached its monthly Prospect Search usage limit. It resets at the start of next month -- contact support if you need it raised sooner.',
        resetsAt,
      );
    }

    if (monthToDateCostUsd >= cap * TENANT_CAP_WARNING_SHARE) {
      this.logger.warn(
        `Tenant ${tenantId} has cost $${monthToDateCostUsd.toFixed(
          2,
        )} upstream this month, nearing their $${cap.toFixed(2)} cap.`,
      );
    }
  }

  /**
   * Forces the next read to go out to BlackPearl, after work known to have
   * spent money. `lastKnown` is deliberately preserved so that if that read
   * then fails, the guard still has figures to enforce against.
   */
  invalidate(): void {
    this.cached = null;
  }
}

/**
 * How much we can still spend before something upstream refuses us: the lower
 * of the prepaid pot and the tightest hard budget. Null when neither is
 * reported, which means "unknown", never "zero".
 */
function bindingRemainingUsd(snapshot: UpstreamBudgetSnapshot): number | null {
  const candidates = [
    snapshot.prepaidBalanceUsd,
    snapshot.tightestHardBudget?.remainingUsd ?? null,
  ].filter((value): value is number => value !== null);

  if (candidates.length === 0) return null;
  return Math.min(...candidates);
}

/** Names the constraint that is binding, so a log line says what refused us. */
function describeConstraint(snapshot: UpstreamBudgetSnapshot): string {
  const project = snapshot.projectId ?? 'unknown project';
  const budget = snapshot.tightestHardBudget;
  const prepaid = snapshot.prepaidBalanceUsd;

  if (budget && (prepaid === null || budget.remainingUsd < prepaid)) {
    return `${budget.scope} hard budget of $${budget.limitUsd.toFixed(
      2,
    )}/month on ${project}`;
  }
  return `organization prepaid balance, project ${project}`;
}

/** Start of next UTC month -- when a monthly window resets. */
function nextMonthStartUtc(now: Date = new Date()): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0),
  );
}
