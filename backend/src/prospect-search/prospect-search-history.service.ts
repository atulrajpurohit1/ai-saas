import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProspectDiscoveryResult } from './types/prospect-search.types';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

@Injectable()
export class ProspectSearchHistoryService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lifts the stored snapshot out of the `filters` JSON column, the same way
   * SavedProspectSearchService does, so the column's shape never reaches the
   * API. Entries recorded before snapshots existed simply have none.
   */
  private storedResult(filters: unknown): ProspectDiscoveryResult | null {
    if (!filters || typeof filters !== 'object' || !('result' in filters)) {
      return null;
    }
    const result = (filters as { result?: unknown }).result;
    return result && typeof result === 'object'
      ? (result as ProspectDiscoveryResult)
      : null;
  }

  async record(input: {
    tenantId: string;
    userId: string;
    prompt: string;
    provider: string;
    resultCount: number;
    /**
     * The results this search produced, kept so reopening it from Recent
     * costs nothing. A repeat search is a second billed BlackPearl job --
     * showing what was already paid for is the whole point of the history.
     */
    result?: ProspectDiscoveryResult;
  }) {
    return this.prisma.prospectSearchHistory.create({
      data: {
        tenantId: input.tenantId,
        userId: input.userId,
        prompt: input.prompt,
        // `filters` has always been written as {} and never read; reusing it
        // for the snapshot keeps this to one JSON column rather than a
        // migration, matching SavedProspectSearch.
        filters: (input.result
          ? { result: input.result }
          : {}) as unknown as Prisma.InputJsonValue,
        provider: input.provider,
        resultCount: input.resultCount,
      },
    });
  }

  /**
   * The chip list only needs to know WHETHER a snapshot exists -- sending
   * every entry's prospects would make an eight-item list hundreds of
   * kilobytes. The snapshot itself is fetched by id, on click.
   */
  async list(tenantId: string, userId: string, limit?: number) {
    const take = Math.min(
      Math.max(limit && Number.isFinite(limit) ? limit : DEFAULT_PAGE_SIZE, 1),
      MAX_PAGE_SIZE,
    );

    const entries = await this.prisma.prospectSearchHistory.findMany({
      where: { tenantId, userId },
      orderBy: { searchedAt: 'desc' },
      take,
    });

    return entries.map(({ filters, ...entry }) => ({
      ...entry,
      hasResult: this.storedResult(filters) !== null,
    }));
  }

  /**
   * One entry's stored results. Scoped to the owning user as well as the
   * tenant, matching list() -- history is per-user, and one user's searches
   * are not another's to reopen.
   */
  async getSnapshot(tenantId: string, userId: string, id: string) {
    const entry = await this.prisma.prospectSearchHistory.findFirst({
      where: { id, tenantId, userId },
    });

    if (!entry) {
      throw new NotFoundException('That search is no longer in your history.');
    }

    const { filters, ...rest } = entry;
    const result = this.storedResult(filters);

    if (!result) {
      throw new NotFoundException(
        'This search has no saved results. Run it again to see prospects.',
      );
    }

    return { ...rest, result };
  }
}
