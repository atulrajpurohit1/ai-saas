import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TelephonyConnection } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RingCentralConnectionService } from './ringcentral-connection.service';
import { RingCentralSubscriptionService } from './ringcentral-subscription.service';
import { RingCentralSyncService } from './ringcentral-sync.service';
import { RingCentralRecordingService } from './ringcentral-recording.service';
import { ringcentralIsConfigured } from './ringcentral.config';

/**
 * Renew a subscription once it is within this long of expiring.
 *
 * Deliberately generous. RingCentral suspends a subscription permanently once
 * it lapses, and recovering means noticing, which nobody does quickly for a
 * tenant who simply stopped receiving calls. Renewing early costs one request.
 */
const RENEW_WITHIN_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class RingCentralScheduler {
  private readonly logger = new Logger(RingCentralScheduler.name);
  private reconciling = false;
  private renewing = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly connections: RingCentralConnectionService,
    private readonly subscriptions: RingCentralSubscriptionService,
    private readonly sync: RingCentralSyncService,
    private readonly recordings: RingCentralRecordingService,
  ) {}

  /**
   * Fills in duration, outcome and recording references for calls the webhook
   * recorded. Every five minutes because RingCentral's call log appears "with
   * a small latency" after a call ends -- a rep who hangs up and looks at the
   * record should not wait long to see how long they talked for.
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async reconcile() {
    if (!ringcentralIsConfigured()) return;
    if (this.reconciling) {
      this.logger.warn('Previous RingCentral reconcile still running; skipping.');
      return;
    }
    this.reconciling = true;

    try {
      const connections = await this.activeConnections();
      let reconciled = 0;

      for (const connection of connections) {
        try {
          const outcome = await this.sync.reconcileTenant(connection);
          reconciled += outcome.reconciled;

          // Recordings are fetched after reconciliation, in the same pass:
          // the recording id only becomes known when the call log is read, so
          // a separate earlier sweep would always be one cycle behind.
          await this.recordings.downloadPending(connection);
        } catch (error) {
          // One tenant's bad credential must not stop the sweep for everyone
          // else. Recorded on the connection so it shows on their own
          // Integrations page rather than only in our logs.
          await this.connections.recordError(connection.id, this.describe(error));
          this.logger.warn(
            `RingCentral reconcile failed for tenant ${connection.tenantId}: ` +
              this.describe(error),
          );
        }
      }

      if (reconciled > 0) {
        this.logger.log(`RingCentral: reconciled ${reconciled} call(s).`);
      }
    } catch (error) {
      // Never rethrow: a failed sweep must not take the scheduler down.
      this.logger.error(`RingCentral reconcile sweep failed: ${this.describe(error)}`);
    } finally {
      this.reconciling = false;
    }
  }

  /**
   * Keeps webhook subscriptions alive.
   *
   * This is the real safety net, not RingCentral's own renewal-reminder event
   * filter. That filter exists, but its payload is undocumented and its
   * threshold is bounded by a job interval RingCentral does not publish --
   * building the only thing standing between a tenant and silent data loss on
   * an undocumented notification would be a poor trade. An hourly sweep off
   * our own table is boring and verifiable.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async renewSubscriptions() {
    if (!ringcentralIsConfigured()) return;
    if (this.renewing) {
      this.logger.warn('Previous RingCentral renewal still running; skipping.');
      return;
    }
    this.renewing = true;

    try {
      const due = await this.prisma.telephonyConnection.findMany({
        where: {
          provider: 'ringcentral',
          status: { in: ['connected', 'degraded'] },
          OR: [
            { subscriptionExpiresAt: null },
            {
              subscriptionExpiresAt: {
                lte: new Date(Date.now() + RENEW_WITHIN_MS),
              },
            },
          ],
        },
      });

      for (const connection of due) {
        try {
          await this.subscriptions.renew(
            connection,
            this.connections.credentialOf(connection),
          );
          // A tenant previously marked degraded by a failed renewal is healthy
          // again the moment one succeeds.
          if (connection.status === 'degraded') {
            await this.prisma.telephonyConnection.update({
              where: { id: connection.id },
              data: { status: 'connected', lastError: null },
            });
          }
        } catch (error) {
          await this.connections.recordError(connection.id, this.describe(error));
          this.logger.warn(
            `RingCentral subscription renewal failed for tenant ` +
              `${connection.tenantId}: ${this.describe(error)}`,
          );
        }
      }
    } catch (error) {
      this.logger.error(`RingCentral renewal sweep failed: ${this.describe(error)}`);
    } finally {
      this.renewing = false;
    }
  }

  private activeConnections(): Promise<TelephonyConnection[]> {
    return this.prisma.telephonyConnection.findMany({
      where: { provider: 'ringcentral', status: { in: ['connected', 'degraded'] } },
    });
  }

  private describe(error: unknown) {
    return error instanceof Error ? error.message : String(error);
  }
}
