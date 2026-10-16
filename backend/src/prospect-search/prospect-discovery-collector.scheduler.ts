import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { DiscoverProspectsDto } from './dto/discover-prospects.dto';
import { ProspectDiscoveryJobService } from './prospect-discovery-job.service';
import { ProspectSearchService } from './prospect-search.service';

/**
 * Finishes prospect discovery searches the server started, whether or not
 * anyone is still watching them.
 *
 * A search runs at BlackPearl; our side only learns what it found by polling.
 * That polling used to happen only in the customer's browser, so a closed tab
 * -- or a laptop shut before a slow search returned -- meant the result was
 * never fetched. The prospects existed and were charged for, and nobody could
 * reach them. This sweep is the server doing its own collecting: it polls
 * through the same code path a browser does, so a job it collects is cached,
 * recorded in history and settled exactly as if someone had sat and waited.
 *
 * Deliberately not instant. Jobs younger than the grace period are left to
 * the page that is probably still polling them; this is the safety net, not
 * the primary path, and polling BlackPearl twice as often as needed costs
 * upstream requests for nothing.
 */
@Injectable()
export class ProspectDiscoveryCollectorScheduler {
  private readonly logger = new Logger(
    ProspectDiscoveryCollectorScheduler.name,
  );
  private running = false;

  /** Left to the customer's own page until this old. */
  private static readonly GRACE_MINUTES = 3;
  /**
   * Past this, a job is assumed lost upstream and retired. Comfortably beyond
   * BlackPearl's observed ~15 minute worst case, and matched by the hourly
   * credit sweep, which returns the hold on anything that never settles.
   */
  private static readonly GIVE_UP_MINUTES = 45;
  /** Kept small: each one is an upstream HTTP call, and the next tick is a minute away. */
  private static readonly BATCH_SIZE = 10;

  constructor(
    private readonly jobs: ProspectDiscoveryJobService,
    private readonly prospectSearch: ProspectSearchService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async collect() {
    // A slow sweep must not overlap the next tick and poll the same jobs twice.
    if (this.running) return;
    this.running = true;

    try {
      const now = Date.now();
      const olderThan = new Date(
        now - ProspectDiscoveryCollectorScheduler.GRACE_MINUTES * 60_000,
      );
      const youngerThan = new Date(
        now - ProspectDiscoveryCollectorScheduler.GIVE_UP_MINUTES * 60_000,
      );

      const due = await this.jobs.pendingForCollection({
        olderThan,
        youngerThan,
        limit: ProspectDiscoveryCollectorScheduler.BATCH_SIZE,
      });

      for (const job of due) {
        await this.collectOne(job);
      }

      await this.retireAbandoned(youngerThan);
    } catch (error) {
      // Never rethrow: a failed sweep must not take the scheduler down. The
      // jobs are still PENDING and the next tick will try them again.
      this.logger.error(
        `Prospect discovery collection sweep failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    } finally {
      this.running = false;
    }
  }

  private async collectOne(job: {
    id: string;
    tenantId: string;
    userId: string;
    jobId: string;
    request: unknown;
  }) {
    try {
      await this.jobs.markPolled(job.id);

      // The stored criteria, replayed: the cache key and the result's own
      // query label are both derived from what was searched for, not from
      // anything the finished job reports.
      const dto = job.request as DiscoverProspectsDto;

      // getDiscoveryJobStatus reads only the tenant and the user id from this,
      // and does the caching, history and settlement itself -- which is the
      // point of going through it rather than reimplementing any of that here.
      const user = {
        sub: job.userId,
        tenantId: job.tenantId,
      } as ActiveUser;

      const status = await this.prospectSearch.getDiscoveryJobStatus(
        job.jobId,
        dto,
        user,
      );

      if (status.status === 'completed') {
        this.logger.log(
          `Collected unattended prospect discovery job ${job.jobId} for tenant ${job.tenantId}: ${status.result.prospects.length} prospect(s) now in their search history.`,
        );
      }
    } catch (error) {
      // A single job failing (upstream 503, malformed stored criteria) must
      // not stop the rest of the batch. It stays PENDING for the next tick.
      this.logger.warn(
        `Could not collect prospect discovery job ${job.jobId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /**
   * Stops polling jobs old enough that BlackPearl is never going to answer.
   * Their held credits are returned by the hourly credit reservation sweep,
   * which is the one place that refunding belongs.
   */
  private async retireAbandoned(cutoff: Date) {
    const stale = await this.jobs.pendingOlderThan(
      cutoff,
      ProspectDiscoveryCollectorScheduler.BATCH_SIZE,
    );

    for (const job of stale) {
      const claimed = await this.jobs.claimTerminal(
        job.tenantId,
        job.jobId,
        'ABANDONED',
        `No result after ${ProspectDiscoveryCollectorScheduler.GIVE_UP_MINUTES} minutes.`,
      );

      if (claimed) {
        this.logger.warn(
          `Gave up on prospect discovery job ${job.jobId} (tenant ${job.tenantId}): no result after ${ProspectDiscoveryCollectorScheduler.GIVE_UP_MINUTES} minutes. Held credits are returned by the credit reservation sweep.`,
        );
      }
    }
  }
}
