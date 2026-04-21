import { Injectable, NotFoundException } from '@nestjs/common';
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

  async create(userId: string, tenantId: string, dto: CreateSiteDto) {
    const site = await this.prisma.site.create({
      data: {
        ...dto,
        tenantId,
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

    const updatedSite = await this.prisma.site.update({
      where: { id },
      data: dto,
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
