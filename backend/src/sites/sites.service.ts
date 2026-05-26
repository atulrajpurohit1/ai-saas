import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateSiteDto } from './dto/create-site.dto';
import { UpdateSiteDto } from './dto/update-site.dto';

@Injectable()
export class SitesService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  private async resolveClientId(tenantId: string, clientId?: string | null) {
    const normalizedClientId = clientId?.trim() || null;
    if (!normalizedClientId) {
      return null;
    }

    const client = await this.prisma.client.findFirst({
      where: { id: normalizedClientId, tenantId },
      select: { id: true },
    });

    if (!client) {
      throw new BadRequestException('Client must belong to this tenant');
    }

    return client.id;
  }

  async create(userId: string, tenantId: string, dto: CreateSiteDto) {
    const clientId = await this.resolveClientId(tenantId, dto.client_id);

    const site = await this.prisma.site.create({
      data: {
        name: dto.name,
        address: dto.address,
        instructions: dto.instructions,
        clientId,
        tenantId,
      },
      include: {
        client: {
          select: { id: true, name: true, companyName: true },
        },
      },
    });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'SITE_CREATED',
      entityType: 'Site',
      entityId: site.id,
      details: `Site "${site.name}" created`,
    });

    return site;
  }

  async findAll(tenantId: string) {
    return this.prisma.site.findMany({
      where: { tenantId },
      include: {
        client: {
          select: { id: true, name: true, companyName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async update(userId: string, tenantId: string, id: string, dto: UpdateSiteDto) {
    const site = await this.prisma.site.findFirst({
      where: { id, tenantId },
    });

    if (!site) {
      throw new NotFoundException('Site not found');
    }

    const clientId =
      dto.client_id === undefined
        ? undefined
        : await this.resolveClientId(tenantId, dto.client_id);

    const updatedSite = await this.prisma.site.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.address !== undefined ? { address: dto.address } : {}),
        ...(dto.instructions !== undefined ? { instructions: dto.instructions } : {}),
        ...(clientId !== undefined ? { clientId } : {}),
      },
      include: {
        client: {
          select: { id: true, name: true, companyName: true },
        },
      },
    });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'SITE_UPDATED',
      entityType: 'Site',
      entityId: site.id,
      details: `Site "${site.name}" updated`,
    });

    return updatedSite;
  }
}
