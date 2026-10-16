import { Injectable, Logger } from '@nestjs/common';
import { Prisma, ProspectDiscoveryJobState } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DiscoverProspectsDto } from './dto/discover-prospects.dto';

/**
 * The record of prospect discovery jobs running upstream.
 *
 * Exists so the server has its own handle on a search. Everything needed to
 * finish a job without a browser -- the upstream job id, the criteria it was
 * submitted for, and who it belongs to -- lives here.
 */
@Injectable()
export class ProspectDiscoveryJobService {
  private readonly logger = new Logger(ProspectDiscoveryJobService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(input: {
    tenantId: string;
    userId: string;
    jobId: string;
    request: DiscoverProspectsDto;
  }) {
    try {
      return await this.prisma.prospectDiscoveryJob.upsert({
        where: {
          tenantId_jobId: { tenantId: input.tenantId, jobId: input.jobId },
        },
        create: {
          tenantId: input.tenantId,
          userId: input.userId,
          jobId: input.jobId,
          request: input.request as unknown as Prisma.InputJsonValue,
        },
        // BlackPearl handing back a job id we already hold means the same
        // search, not a new one; the existing row (and its status) stands.
        update: {},
      });
    } catch (error) {
      // Losing this row costs the server-side safety net, not the search
      // itself -- the customer's own page is still polling. Failing the
      // submission over it would be the worse trade.
      this.logger.error(
        `Could not record discovery job ${input.jobId} for tenant ${input.tenantId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }

  /**
   * Moves a job to a terminal state, and reports whether THIS caller is the
   * one that moved it.
   *
   * The update is conditional on the row still being PENDING, so of the two
   * pollers that can reach a finished job -- the customer's page and the
   * collector -- exactly one gets `true` and performs the side effects. The
   * condition lives in the WHERE clause rather than in a read-then-write, so
   * two simultaneous pollers cannot both pass it.
   */
  async claimTerminal(
    tenantId: string,
    jobId: string,
    status: Extract<
      ProspectDiscoveryJobState,
      'COMPLETED' | 'FAILED' | 'ABANDONED'
    >,
    note?: string,
  ): Promise<boolean> {
    try {
      const { count } = await this.prisma.prospectDiscoveryJob.updateMany({
        where: {
          tenantId,
          jobId,
          status: ProspectDiscoveryJobState.PENDING,
        },
        data: {
          status: ProspectDiscoveryJobState[status],
          completedAt: new Date(),
          ...(note ? { note } : {}),
        },
      });

      return count > 0;
    } catch (error) {
      this.logger.error(
        `Could not claim discovery job ${jobId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      // A job whose row cannot be claimed must still be delivered to the
      // customer in front of us, so this reports "claimed" and accepts a
      // possible duplicate record over a result that reaches nobody. The
      // credit ledger's own unique constraint still prevents double billing.
      return true;
    }
  }

  /**
   * Jobs the collector should look at: still pending, old enough that the
   * page watching them has likely given up, and young enough to be worth
   * polling at all.
   */
  async pendingForCollection(params: {
    olderThan: Date;
    youngerThan: Date;
    limit: number;
  }) {
    return this.prisma.prospectDiscoveryJob.findMany({
      where: {
        status: ProspectDiscoveryJobState.PENDING,
        createdAt: { lt: params.olderThan, gt: params.youngerThan },
      },
      orderBy: { createdAt: 'asc' },
      take: params.limit,
    });
  }

  /** Pending jobs too old to be worth polling, for the collector to retire. */
  async pendingOlderThan(cutoff: Date, limit: number) {
    return this.prisma.prospectDiscoveryJob.findMany({
      where: {
        status: ProspectDiscoveryJobState.PENDING,
        createdAt: { lte: cutoff },
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
  }

  async markPolled(id: string) {
    try {
      await this.prisma.prospectDiscoveryJob.update({
        where: { id },
        data: { lastPolledAt: new Date() },
      });
    } catch {
      // Bookkeeping only: a missed timestamp costs nothing.
    }
  }
}
