import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CreditsService } from './credits.service';

/**
 * Returns credits held by Prospect Search jobs that never finished.
 *
 * A hold is normally settled when the frontend polls a job to a terminal
 * status. Nothing guarantees that poll ever happens: the user closes the tab,
 * the backend restarts mid-job, or BlackPearl simply never reports a result.
 * Without this sweep those credits stay held forever -- the customer has paid
 * for them, cannot spend them, and has no way to get them back themselves.
 *
 * This is the last resort, not the normal path. Prospect Search's
 * AbandonedJobScheduler settles abandoned jobs first, after asking BlackPearl
 * how each one ended, so their cost is recorded. A blind release records
 * nothing, and once a hold is released a later settle is ignored -- so this
 * waits a full day, well past that scheduler's own six-hour limit, and only
 * catches what it could not settle.
 */
@Injectable()
export class CreditReservationScheduler {
  private readonly logger = new Logger(CreditReservationScheduler.name);
  private running = false;

  /** Holds younger than this are left to AbandonedJobScheduler. */
  private static readonly STALE_AFTER_MINUTES = 24 * 60;

  constructor(private readonly credits: CreditsService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async sweep() {
    // A slow run must not overlap with the next tick.
    if (this.running) {
      this.logger.warn(
        'Previous credit reservation sweep still running; skipping this tick.',
      );
      return;
    }
    this.running = true;

    try {
      return await this.credits.expireStaleReservations(
        CreditReservationScheduler.STALE_AFTER_MINUTES,
      );
    } catch (error) {
      // Never rethrow: a failed sweep must not take the scheduler down. The
      // holds are still there and the next tick will try again.
      this.logger.error(
        `Credit reservation sweep failed: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
      return { expired: 0, released: 0 };
    } finally {
      this.running = false;
    }
  }
}
