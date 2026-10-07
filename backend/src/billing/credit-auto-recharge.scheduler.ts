import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CreditAutoRechargeService } from './credit-auto-recharge.service';

/**
 * Checks every 15 minutes for tenants whose balance has fallen below their
 * auto-recharge threshold.
 *
 * More often than the hourly alert sweep, because this one is meant to top up
 * before work stops rather than just warn; not on the spend path, because a
 * card charge does not belong inside the request that spends a credit.
 */
@Injectable()
export class CreditAutoRechargeScheduler {
  private readonly logger = new Logger(CreditAutoRechargeScheduler.name);
  private running = false;

  constructor(private readonly autoRecharge: CreditAutoRechargeService) {}

  @Cron(CronExpression.EVERY_30_MINUTES)
  async sweep() {
    // Two concurrent sweeps could both see a low balance and both charge.
    if (this.running) {
      this.logger.warn(
        'Previous auto-recharge sweep still running; skipping this tick.',
      );
      return;
    }
    this.running = true;

    try {
      const outcome = await this.autoRecharge.sweep();
      if (outcome.recharged > 0 || outcome.failed > 0) {
        this.logger.log(
          `Auto-recharge sweep: ${outcome.configsChecked} checked, ${outcome.recharged} recharged, ${outcome.skipped} skipped, ${outcome.failed} failed.`,
        );
      }
      return outcome;
    } catch (error) {
      // Never rethrow: a failed sweep must not take the scheduler down.
      this.logger.error(
        `Auto-recharge sweep failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    } finally {
      this.running = false;
    }
  }
}
