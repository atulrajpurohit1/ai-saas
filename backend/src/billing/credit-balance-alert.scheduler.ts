import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CreditBalanceAlertService } from './credit-balance-alert.service';

/**
 * Hourly check for tenants whose Prospect Search credits are running low.
 *
 * Hourly rather than on every spend: the alert is a heads-up, not a real-time
 * gate -- reserve() already blocks a search that cannot be paid for -- and
 * checking on the spend path would put an email send inside the request that
 * spends the credit.
 */
@Injectable()
export class CreditBalanceAlertScheduler {
  private readonly logger = new Logger(CreditBalanceAlertScheduler.name);
  private running = false;

  constructor(private readonly alerts: CreditBalanceAlertService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async sweep() {
    // A slow run must not overlap with the next tick: two concurrent sweeps
    // could both decide an alert is due.
    if (this.running) {
      this.logger.warn(
        'Previous credit balance alert sweep still running; skipping this tick.',
      );
      return;
    }
    this.running = true;

    try {
      const outcome = await this.alerts.sweep();
      if (outcome.alertsSent > 0 || outcome.failures > 0) {
        this.logger.log(
          `Credit balance sweep: ${outcome.tenantsChecked} checked, ${outcome.alertsSent} alert(s) sent, ${outcome.alertsCleared} cleared, ${outcome.failures} failure(s).`,
        );
      }
      return outcome;
    } catch (error) {
      // Never rethrow: a failed sweep must not take the scheduler down.
      this.logger.error(
        `Credit balance alert sweep failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    } finally {
      this.running = false;
    }
  }
}
