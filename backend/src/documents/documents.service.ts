import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateDocumentDto } from './dto/create-document.dto';

@Injectable()
export class DocumentsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async create(tenantId: string, uploadedBy: string, data: CreateDocumentDto) {
    const name = data.name?.trim();
    const url = data.url?.trim();
    const description = data.description?.trim() || undefined;
    const clientId = data.clientId?.trim();

    if (!name || !url || !clientId) {
      throw new BadRequestException('Document name, URL, and client are required');
    }

    const client = await this.prisma.client.findFirst({
      where: { id: clientId, tenantId },
    });

    if (!client) {
      throw new NotFoundException('Client not found in this tenant');
    }

    const document = await this.prisma.sharedDocument.create({
      data: {
        name,
        url,
        description,
        clientId,
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
      details: `Document "${name}" shared with ${client.name}`,
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
