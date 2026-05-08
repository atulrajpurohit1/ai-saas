import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class DocumentsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async create(tenantId: string, uploadedBy: string, data: { name: string, url: string, description?: string, clientId: string }) {
    const document = await this.prisma.sharedDocument.create({
      data: {
        ...data,
        tenantId,
        uploadedBy,
      },
    });

    await this.auditService.log({
      tenantId,
      userId: uploadedBy,
      action: 'DOCUMENT_SHARED',
      entityType: 'Document',
      entityId: document.id,
      details: `Document "${data.name}" shared with client`,
    });

    return document;
  }

  async findAll(tenantId: string, clientId?: string) {
    return this.prisma.sharedDocument.findMany({
      where: { 
        tenantId,
        ...(clientId ? { clientId } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const document = await this.prisma.sharedDocument.findFirst({
      where: { id, tenantId },
    });

    if (!document) throw new NotFoundException('Document not found');
    return document;
  }

  async remove(tenantId: string, id: string, userId: string) {
    await this.findOne(tenantId, id);
    
    const deleted = await this.prisma.sharedDocument.delete({
      where: { id },
    });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'DOCUMENT_DELETED',
      entityType: 'Document',
      entityId: id,
    });

    return deleted;
  }
}
