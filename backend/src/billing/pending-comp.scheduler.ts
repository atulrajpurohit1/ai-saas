import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PendingCompService } from './pending-comp.service';

/**
 * Starts complimentary plans that were queued behind a paid subscription.
 *
 * Hourly rather than daily: the gap between the paid plan ending and the free
 * plan starting is a window in which the tenant has no entitlements at all, and
 * a locked-out customer is not something to leave until tomorrow morning. The
 * Stripe cancellation event normally closes that window immediately; this is
 * the backstop for tenants with no Stripe subscription to send one, and for
 * events that never arrive.
 *
 * Cheap to run often: the query is an indexed lookup that matches nothing in
 * the ordinary case.
 */
@Injectable()
export class PendingCompScheduler {
  private readonly logger = new Logger(PendingCompScheduler.name);
  private running = false;

  constructor(private readonly pendingComps: PendingCompService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async sweep() {
    // Two overlapping sweeps would both try to activate the same grant. The
    // second would find the columns already cleared and do nothing, but the
    // provisioning in between is wasted work and a confusing audit trail.
    if (this.running) {
      this.logger.warn(
        'Previous queued-comp sweep still running; skipping this tick.',
      );
      return;
    }
    this.running = true;

    try {
      const outcome = await this.pendingComps.activateDue();
      if (outcome.activated > 0 || outcome.failures > 0) {
        this.logger.log(
          `Queued comp sweep: ${outcome.due} due, ${outcome.activated} activated, ` +
            `${outcome.failures} failure(s).`,
        );
      }
      return outcome;
    } catch (error) {
      // Never rethrow: a failed sweep must not take the scheduler down.
      this.logger.error(
        `Queued comp sweep failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    } finally {
      this.running = false;
    }
  }
}
