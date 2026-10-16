import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BandDriftService } from './band-drift.service';

/**
 * Daily check for customers who have outgrown the guard band they pay for.
 *
 * Daily rather than hourly: the sweep makes one Stripe call per subscribed
 * tenant, and a band only moves when headcount crosses a threshold -- there is
 * nothing to gain from noticing it eight hours sooner, and a repricing
 * conversation happens on a human timescale anyway.
 *
 * 7am UTC so the digest is waiting at the start of the business day rather
 * than arriving overnight.
 */
@Injectable()
export class BandDriftScheduler {
  private readonly logger = new Logger(BandDriftScheduler.name);
  private running = false;

  constructor(private readonly bandDrift: BandDriftService) {}

  @Cron(CronExpression.EVERY_DAY_AT_7AM)
  async sweep() {
    // A slow run must not overlap the next tick: two concurrent sweeps would
    // each send their own digest of the same drift.
    if (this.running) {
      this.logger.warn(
        'Previous guard band drift sweep still running; skipping this tick.',
      );
      return;
    }
    this.running = true;

    try {
      const outcome = await this.bandDrift.sweep();
      if (outcome.drifted.length > 0 || outcome.failures > 0) {
        this.logger.log(
          `Guard band drift sweep: ${outcome.tenantsChecked} checked, ` +
            `${outcome.drifted.length} drifted, $${outcome.monthlyShortfall}/month ` +
            `under list price, ${outcome.failures} failure(s).`,
        );
      }
      return outcome;
    } catch (error) {
      // Never rethrow: a failed sweep must not take the scheduler down.
      this.logger.error(
        `Guard band drift sweep failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    } finally {
      this.running = false;
    }
  }
}
