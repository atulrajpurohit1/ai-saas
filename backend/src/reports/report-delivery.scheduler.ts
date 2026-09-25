import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { ReportsService } from './reports.service';

/**
 * Sends daily service reports to clients who chose AUTOMATIC delivery.
 *
 * "End of shift" is not a single moment -- shift end times vary by site, and a
 * tenant may run overnight cover that finishes the next morning. Rather than
 * trying to fire at each site's exact end time, this sweeps hourly and sends
 * any published report that has not yet gone out. A report only becomes
 * publishable once its shifts are done, so in practice it goes within the hour
 * of the day's work closing.
 *
 * The sweep is deliberately boring: it is idempotent, it skips anything it has
 * already sent, and one tenant's failure never stops another's.
 */
@Injectable()
export class ReportDeliveryScheduler {
  private readonly logger = new Logger(ReportDeliveryScheduler.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly reports: ReportsService,
    private readonly entitlements: EntitlementsService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async sweep() {
    // A slow run must not overlap with the next tick and double-send.
    if (this.running) {
      this.logger.warn('Previous sweep still running; skipping this tick.');
      return;
    }
    this.running = true;

    try {
      await this.deliverPending();
    } catch (error) {
      this.logger.error(
        `Report delivery sweep failed: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    } finally {
      this.running = false;
    }
  }

  /** Exposed so it can be triggered directly, and tested without waiting. */
  async deliverPending() {
    // Only the last few days: a report that has sat unsent for a week is a
    // problem to investigate, not something to surprise a client with now.
    const since = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

    const pending = await this.prisma.dailyServiceReport.findMany({
      where: {
        status: 'published',
        reportDate: { gte: since },
        emailSentAt: null,
        client: {
          reportEmailEnabled: true,
          reportEmailMode: 'AUTOMATIC',
        },
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            companyName: true,
            email: true,
            reportEmailEnabled: true,
            reportEmailMode: true,
            reportEmailCc: true,
          },
        },
        site: { select: { id: true, name: true, address: true } },
      },
      take: 100,
    });

    if (!pending.length) return { considered: 0, sent: 0 };

    let sent = 0;
    for (const report of pending) {
      // Guard Tour is what produces these reports. A tenant that has let the
      // service lapse should stop sending, not keep mailing clients.
      const entitled = await this.entitlements.hasModule(
        report.tenantId,
        'GUARD_TOUR',
      );
      if (!entitled) continue;

      const result = await this.reports.deliverReportByEmail(
        report,
        'automatic',
      );

      if (result.sent) {
        // Stamped only on success, so a failure is retried next sweep rather
        // than silently dropped.
        await this.prisma.dailyServiceReport.update({
          where: { id: report.id },
          data: { emailSentAt: new Date() },
        });
        sent += 1;
      }
    }

    if (sent) {
      this.logger.log(
        `Automatic report delivery: sent ${sent} of ${pending.length} pending.`,
      );
    }

    return { considered: pending.length, sent };
  }
}
