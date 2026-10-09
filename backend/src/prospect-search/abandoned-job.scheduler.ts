import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CreditsService } from '../billing/credits.service';
import { BlackPearlProspectingProvider } from './providers/blackpearl-prospecting.provider';
import { UpstreamBudgetService } from './upstream-budget.service';

/**
 * Settles Prospect Search jobs that nobody is polling any more.
 *
 * A hold is normally settled when the page polls its job to a finish. When the
 * page stops waiting -- the tab closed, or the search ran past the page's own
 * time limit -- nothing ever learns how the job ended. The billing sweep used
 * to release those holds blind after an hour, which lost what BlackPearl
 * charged us for them: in early October half of all discovery searches went
 * that way, every one with its cost unrecorded.
 *
 * So each abandoned hold is checked against BlackPearl first:
 *
 *   - still running: left alone until GIVE_UP_AFTER_MINUTES.
 *   - finished either way: refunded, with BlackPearl's cost recorded.
 *
 * A search that SUCCEEDED is refunded too, not charged. Its results only ever
 * reach the customer through the page that was polling it, and nothing stores
 * them for later, so the customer was never given what they would be paying
 * for. Recording the cost is the point here; charging needs results the
 * customer can reach first.
 */

/**
 * Past the longest the page itself polls a job (20 minutes for discovery, 30
 * for a playbook), so this never settles a job the page may still settle.
 */
const RECONCILE_AFTER_MINUTES = 45;

/**
 * A job BlackPearl still reports as running, or whose status cannot be read,
 * is refunded anyway after this long. Its worst observed case is ~15 minutes,
 * so a job running for hours is not coming back, and the customer should not
 * be kept waiting for their credits.
 */
const GIVE_UP_AFTER_MINUTES = 6 * 60;

export type AbandonedJobOutcome = 'succeeded' | 'failed' | 'expired';

@Injectable()
export class AbandonedJobScheduler {
  private readonly logger = new Logger(AbandonedJobScheduler.name);
  private running = false;

  constructor(
    private readonly credits: CreditsService,
    private readonly provider: BlackPearlProspectingProvider,
    private readonly upstreamBudget: UpstreamBudgetService,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async reconcile(): Promise<Record<AbandonedJobOutcome, number>> {
    const counts: Record<AbandonedJobOutcome, number> = {
      succeeded: 0,
      failed: 0,
      expired: 0,
    };

    // A slow run must not overlap with the next tick.
    if (this.running) return counts;
    this.running = true;

    try {
      const holds = await this.credits.findPendingReservations(
        RECONCILE_AFTER_MINUTES,
      );

      for (const hold of holds) {
        try {
          const outcome = await this.settleHold(hold);
          if (outcome) counts[outcome] += 1;
        } catch (error) {
          // One bad hold must not stop the rest; it is retried next tick.
          this.logger.error(
            `Could not reconcile abandoned job ${hold.jobId ?? hold.id}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      }

      if (counts.succeeded + counts.failed + counts.expired > 0) {
        this.logger.log(
          `Reconciled abandoned Prospect Search jobs: ${counts.succeeded} succeeded, ${counts.failed} failed, ${counts.expired} expired. All refunded.`,
        );
      }
    } catch (error) {
      // Never rethrow: a failed run must not take the scheduler down.
      this.logger.error(
        `Abandoned job reconciliation failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    } finally {
      this.running = false;
    }

    return counts;
  }

  private async settleHold(hold: {
    id: string;
    jobId: string | null;
    createdAt: Date;
  }): Promise<AbandonedJobOutcome | null> {
    const outcome = hold.jobId
      ? await this.provider.getJobOutcome(hold.jobId)
      : null;

    let result: AbandonedJobOutcome;
    let description: string;

    if (outcome?.status === 'succeeded') {
      result = 'succeeded';
      description =
        'Search finished after the page stopped waiting for it; credits returned.';
    } else if (outcome?.status === 'failed') {
      result = 'failed';
      description = 'Search could not be completed; credits returned.';
    } else {
      const ageMinutes = (Date.now() - hold.createdAt.getTime()) / 60_000;
      if (ageMinutes < GIVE_UP_AFTER_MINUTES) return null;
      result = 'expired';
      description =
        'Search did not complete in time; credits returned automatically.';
    }

    const settled = await this.credits.settle({
      reservationId: hold.id,
      actualUsed: 0,
      description,
      upstreamCostUsd: outcome?.upstreamCostUsd ?? null,
    });
    if (!settled) return null;

    // Spending has happened, so any cached view of our prepaid balance is now
    // stale.
    this.upstreamBudget.invalidate();
    return result;
  }
}
