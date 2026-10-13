import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { UpstreamSolvencyService } from './upstream-solvency.service';

/**
 * Hourly check that the prepaid BlackPearl pot still covers the credits we
 * have sold.
 *
 * Hourly, and not on the search path: the figure moves when credits are
 * bought or spent, neither of which is urgent to the second, and it costs a
 * forced remote balance read that has no business being inside a customer's
 * search. Mirrors CreditBalanceAlertScheduler, including the overlap guard --
 * two concurrent runs would double-log the same shortfall.
 */
@Injectable()
export class UpstreamSolvencyScheduler {
  private readonly logger = new Logger(UpstreamSolvencyScheduler.name);
  private running = false;

  constructor(private readonly solvency: UpstreamSolvencyService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async sweep() {
    if (this.running) {
      this.logger.warn(
        'Previous upstream solvency check still running; skipping this tick.',
      );
      return;
    }
    this.running = true;
    try {
      await this.solvency.check();
    } catch (error) {
      // A failed check must never take the process down: it is reporting, not
      // a gate on anything.
      this.logger.error(
        `Upstream solvency check failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    } finally {
      this.running = false;
    }
  }
}
