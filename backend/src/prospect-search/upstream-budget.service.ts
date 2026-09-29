import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BlackPearlProspectingProvider } from './providers/blackpearl-prospecting.provider';

/**
 * Guards the finite, prepaid BlackPearl balance that funds Prospect Search.
 *
 * AegisLead is not on a BlackPearl plan with a monthly allowance -- it runs on
 * a one-off prepaid grant. That has two consequences the rest of the system
 * was built without:
 *
 *   1. There is no overage. When the balance reaches zero, Prospect Search
 *      stops working for every tenant at once. Nothing degrades gracefully.
 *   2. A single tenant can consume the whole pot. Customer credits are sold
 *      per search, but our cost per search is set by BlackPearl's compute and
 *      varies by roughly an order of magnitude, so a handful of expensive
 *      searches can drain far more than their sale price suggests.
 *
 * So the balance is checked before submitting billed work, and jobs are
 * refused once it falls below a reserve floor. Refusing a search is a bad
 * outcome; discovering the pot is empty because a customer's search failed
 * mid-flight is a worse one.
 *
 * The balance is cached briefly: it only moves when we spend, and a remote
 * call on the path of every search would add latency to the thing we are
 * trying to protect.
 */

/** How long a fetched balance is trusted before being re-read. */
const BALANCE_CACHE_MS = 60_000;

/**
 * Default USD floor below which new billed jobs are refused. Held back so
 * in-flight jobs can settle, and so the account does not hit exactly zero --
 * which is where behaviour is least predictable.
 */
const DEFAULT_RESERVE_FLOOR_USD = 25;

@Injectable()
export class UpstreamBudgetService {
  private readonly logger = new Logger(UpstreamBudgetService.name);
  private cached: { balanceUsd: number | null; fetchedAt: number } | null =
    null;
  /**
   * Last balance we successfully read, kept even once the cache is expired or
   * invalidated. A stale figure is far more useful than none: `null` means
   * "unknown", and assertCanSpend deliberately allows spending when the
   * balance is unknown, so losing the last known value would silently disable
   * the guard exactly when BlackPearl is having trouble.
   */
  private lastKnownBalanceUsd: number | null = null;

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
   * Current prepaid balance in USD, or null when it cannot be determined.
   * `force` skips the cache, for the admin-facing read where staleness would
   * be misleading.
   */
  async getBalanceUsd(force = false): Promise<number | null> {
    const now = Date.now();

    if (
      !force &&
      this.cached &&
      now - this.cached.fetchedAt < BALANCE_CACHE_MS
    ) {
      return this.cached.balanceUsd;
    }

    let balanceUsd: number | null = null;
    try {
      balanceUsd = await this.provider.getUpstreamBalanceUsd();
    } catch (error) {
      // A failed balance read must not block searches -- see assertCanSpend.
      // Fall back to the last figure we actually saw rather than to null:
      // a slightly stale balance still enforces the floor, where null
      // switches the guard off entirely.
      this.logger.warn(
        `Could not read BlackPearl prepaid balance, falling back to last known value: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return this.lastKnownBalanceUsd;
    }

    this.cached = { balanceUsd, fetchedAt: now };
    if (balanceUsd !== null) {
      this.lastKnownBalanceUsd = balanceUsd;
    }
    return balanceUsd;
  }

  /**
   * Throws 503 when the prepaid balance is too low to start new billed work.
   *
   * Deliberately fails OPEN when the balance is unknown (BlackPearl
   * unreachable, or an account that reports no prepaid balance): an unknown
   * balance is not evidence of an empty one, and refusing every search because
   * a status endpoint is down would turn a monitoring problem into an outage.
   * The exhausted case is caught by BlackPearl's own error anyway; this guard
   * exists to catch it earlier and more cheaply, not as the only line.
   */
  async assertCanSpend(): Promise<void> {
    const balanceUsd = await this.getBalanceUsd();
    if (balanceUsd === null) return;

    const floor = this.reserveFloorUsd();
    if (balanceUsd <= floor) {
      this.logger.error(
        `BlackPearl prepaid balance is $${balanceUsd.toFixed(
          2,
        )}, at or below the $${floor.toFixed(
          2,
        )} reserve floor. Refusing new Prospect Search jobs.`,
      );
      throw new ServiceUnavailableException(
        'Prospect Search is temporarily unavailable. Please try again later or contact support.',
      );
    }

    // Warn while there is still time to act, rather than only at the floor.
    if (balanceUsd <= floor * 4) {
      this.logger.warn(
        `BlackPearl prepaid balance is low: $${balanceUsd.toFixed(2)} remaining (floor $${floor.toFixed(2)}).`,
      );
    }
  }

  /**
   * Forces the next read to go out to BlackPearl, after work known to have
   * spent money. `lastKnownBalanceUsd` is deliberately preserved so that if
   * that read then fails, the guard still has a figure to enforce against.
   */
  invalidate(): void {
    this.cached = null;
  }
}
