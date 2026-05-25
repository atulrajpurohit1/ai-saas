import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

type NoteEntityType = 'lead' | 'deal';

type NoteRecord = {
  id: string;
  content: string;
  leadId: string | null;
  dealId: string | null;
  tenantId: string;
  createdAt: Date;
};

@Injectable()
export class NotesService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  private async attachCreatedBy(notes: NoteRecord[]) {
    if (notes.length === 0) return [];

    const noteIds = notes.map((note) => note.id);
    const createLogs = await this.prisma.auditLog.findMany({
      where: {
        entityId: { in: noteIds },
        entityType: 'NOTE',
        action: 'CREATE',
        userId: { not: null },
      },
      orderBy: { createdAt: 'asc' },
      select: {
        entityId: true,
        userId: true,
      },
    });

    const noteCreatorIds = new Map<string, string>();
    for (const log of createLogs) {
      if (log.entityId && log.userId && !noteCreatorIds.has(log.entityId)) {
        noteCreatorIds.set(log.entityId, log.userId);
      }
    }

    const userIds = [...new Set(noteCreatorIds.values())];
    const users = userIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: userIds } },
          select: {
            id: true,
            name: true,
            email: true,
          },
        })
      : [];

    const usersById = new Map(users.map((user) => [user.id, user]));

    return notes.map((note) => {
      const creatorId = noteCreatorIds.get(note.id);
      const creator = creatorId ? usersById.get(creatorId) : undefined;

      return {
        ...note,
        createdBy: creator
          ? {
              id: creator.id,
              name: creator.name,
              email: creator.email,
            }
          : null,
      };
    });
  }

  private async ensureEntityExists(
    entityId: string,
    type: NoteEntityType,
    tenantId: string,
  ) {
    const entity =
      type === 'lead'
        ? await this.prisma.lead.findFirst({
            where: { id: entityId, tenantId },
            select: { id: true },
          })
        : await this.prisma.deal.findFirst({
            where: { id: entityId, tenantId },
            select: { id: true },
          });

    if (!entity) {
      throw new NotFoundException(
        `${type === 'lead' ? 'Lead' : 'Deal'} not found in this tenant`,
      );
    }
  }

  async create(data: {
    content: string;
    leadId?: string;
    dealId?: string;
    tenantId: string;
    userId?: string;
  }) {
    const content = data.content?.trim();
    const hasLead = Boolean(data.leadId);
    const hasDeal = Boolean(data.dealId);

    if (!content) {
      throw new BadRequestException('Note content is required');
    }

    if (hasLead === hasDeal) {
      throw new BadRequestException('Provide exactly one of leadId or dealId');
    }

    if (data.leadId) {
      await this.ensureEntityExists(data.leadId, 'lead', data.tenantId);
    }

    if (data.dealId) {
      await this.ensureEntityExists(data.dealId, 'deal', data.tenantId);
    }

    const note = await this.prisma.note.create({
      data: {
        content,
        leadId: data.leadId,
        dealId: data.dealId,
        tenantId: data.tenantId,
      },
    });

    await this.auditService.log({
      tenantId: data.tenantId,
      userId: data.userId,
      action: 'CREATE',
      entityType: 'NOTE',
      entityId: note.id,
      details: `Created note for ${data.leadId ? 'Lead' : 'Deal'}`,
    });

    const [noteWithCreator] = await this.attachCreatedBy([note]);
    return noteWithCreator;
  }

  async findByEntity(entityId: string, type: NoteEntityType, tenantId: string) {
    if (!entityId || !['lead', 'deal'].includes(type)) {
      throw new BadRequestException('Valid entityId and type are required');
    }

    await this.ensureEntityExists(entityId, type, tenantId);

    const notes = await this.prisma.note.findMany({
      where: {
        AND: [
          type === 'lead' ? { leadId: entityId } : { dealId: entityId },
          { tenantId },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });

    return this.attachCreatedBy(notes);
  }

  async remove(id: string, tenantId: string, userId?: string) {
    const note = await this.prisma.note.findFirst({
      where: { id, tenantId },
    });

    if (!note) throw new NotFoundException('Note not found');

    await this.prisma.note.delete({ where: { id } });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'DELETE',
      entityType: 'NOTE',
      entityId: id,
    });

    return { success: true };
  }
}
