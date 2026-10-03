import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Saved searches are tenant-shared resources, matching how Leads/Deals/Notes
 * already work in this codebase - visible and editable by anyone in the
 * tenant with the right permission, not restricted to the original creator.
 * userId is stored only as "created by" metadata.
 */
@Injectable()
export class SavedProspectSearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async list(tenantId: string) {
    const saved = await this.prisma.savedProspectSearch.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });

    return saved.map((entry) => this.withResult(entry));
  }

  /**
   * Lifts the stored snapshot out of the `filters` JSON column so callers see
   * a flat `result`, and never leaks the column's shape into the API.
   */
  private withResult<T extends { filters: unknown }>(entry: T) {
    const filters = entry.filters;
    const result =
      filters && typeof filters === 'object' && 'result' in filters
        ? (filters as { result?: unknown }).result
        : undefined;

    const { filters: _filters, ...rest } = entry;
    return { ...rest, result: result ?? undefined };
  }

  async create(input: {
    tenantId: string;
    userId: string;
    name: string;
    prompt: string;
    result?: Record<string, unknown>;
  }) {
    const saved = await this.prisma.savedProspectSearch.create({
      data: {
        tenantId: input.tenantId,
        userId: input.userId,
        name: input.name.trim(),
        prompt: input.prompt,
        // The `filters` column has always been written as {} and never read.
        // Reusing it to hold the saved result snapshot keeps this change to
        // one JSON column instead of a schema migration; `result` is the only
        // key anything looks for, so an older row of {} just reads as absent.
        filters: (input.result
          ? { result: input.result }
          : {}) as Prisma.InputJsonValue,
      },
    });

    await this.auditService.log({
      tenantId: input.tenantId,
      userId: input.userId,
      action: 'SAVED_SEARCH_CREATED',
      entityType: 'SAVED_PROSPECT_SEARCH',
      entityId: saved.id,
      details: `Saved search "${saved.name}"`,
    });

    return this.withResult(saved);
  }

  async rename(id: string, tenantId: string, userId: string, name: string) {
    await this.ensureExists(id, tenantId);

    const updated = await this.prisma.savedProspectSearch.update({
      where: { id },
      data: { name: name.trim() },
    });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'SAVED_SEARCH_RENAMED',
      entityType: 'SAVED_PROSPECT_SEARCH',
      entityId: id,
      details: `Renamed saved search to "${updated.name}"`,
    });

    return this.withResult(updated);
  }

  async remove(id: string, tenantId: string, userId: string) {
    const existing = await this.ensureExists(id, tenantId);

    await this.prisma.savedProspectSearch.delete({ where: { id } });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'SAVED_SEARCH_DELETED',
      entityType: 'SAVED_PROSPECT_SEARCH',
      entityId: id,
      details: `Deleted saved search "${existing.name}"`,
    });

    return { success: true };
  }

  private async ensureExists(id: string, tenantId: string) {
    const existing = await this.prisma.savedProspectSearch.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      throw new NotFoundException('Saved search not found');
    }

    return existing;
  }
}
