import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ProspectSearchFilters } from '../ai/ai.service';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
}

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
    return this.prisma.savedProspectSearch.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(input: {
    tenantId: string;
    userId: string;
    name: string;
    prompt: string;
    filters: ProspectSearchFilters;
  }) {
    const saved = await this.prisma.savedProspectSearch.create({
      data: {
        tenantId: input.tenantId,
        userId: input.userId,
        name: input.name.trim(),
        prompt: input.prompt,
        filters: toJsonValue(input.filters),
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

    return saved;
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

    return updated;
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
