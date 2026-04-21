import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class NotesService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async create(data: {
    content: string;
    leadId?: string;
    dealId?: string;
    tenantId: string;
    userId?: string;
  }) {
    const note = await this.prisma.note.create({
      data: {
        content: data.content,
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

    return note;
  }

  async findByEntity(entityId: string, type: 'lead' | 'deal', tenantId: string) {
    return this.prisma.note.findMany({
      where: {
        AND: [
          type === 'lead' ? { leadId: entityId } : { dealId: entityId },
          { tenantId },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });
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
