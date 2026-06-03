import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { branchScopedWhere, branchWhere, resolveWriteBranchId } from '../branches/branch-scope';
import { CreateSiteDto } from './dto/create-site.dto';
import { UpdateSiteDto } from './dto/update-site.dto';

@Injectable()
export class SitesService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  private async resolveClientId(user: ActiveUser, branchId: string | null, clientId?: string | null) {
    const normalizedClientId = clientId?.trim() || null;
    if (!normalizedClientId) {
      return null;
    }

    const client = await this.prisma.client.findFirst({
      where: { id: normalizedClientId, tenantId: user.tenantId, ...branchWhere(user) },
      select: { id: true, branchId: true },
    });

    if (!client) {
      throw new BadRequestException('Client must belong to this tenant');
    }

    if (branchId && client.branchId && client.branchId !== branchId) {
      throw new BadRequestException('Client must belong to the selected branch');
    }

    return client.id;
  }

  async create(user: ActiveUser, dto: CreateSiteDto) {
    const branchId = resolveWriteBranchId(user, dto.branch_id);
    const clientId = await this.resolveClientId(user, branchId, dto.client_id);

    const site = await this.prisma.site.create({
      data: {
        name: dto.name,
        address: dto.address,
        instructions: dto.instructions,
        clientId,
        tenantId: user.tenantId,
        branchId,
      },
      include: {
        branch: {
          select: { id: true, name: true, location: true, status: true },
        },
        client: {
          select: { id: true, name: true, companyName: true },
        },
      },
    });

    await this.auditService.log({
      tenantId: user.tenantId,
      userId: user.sub,
      action: 'SITE_CREATED',
      entityType: 'Site',
      entityId: site.id,
      details: `Site "${site.name}" created`,
    });

    return site;
  }

  async findAll(user: ActiveUser, requestedBranchId?: string | null) {
    return this.prisma.site.findMany({
      where: branchScopedWhere(user, requestedBranchId),
      include: {
        branch: {
          select: { id: true, name: true, location: true, status: true },
        },
        client: {
          select: { id: true, name: true, companyName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async update(user: ActiveUser, id: string, dto: UpdateSiteDto) {
    const site = await this.prisma.site.findFirst({
      where: { id, tenantId: user.tenantId, ...branchWhere(user) },
    });

    if (!site) {
      throw new NotFoundException('Site not found');
    }

    const branchId =
      dto.branch_id === undefined
        ? undefined
        : resolveWriteBranchId(user, dto.branch_id);
    const effectiveBranchId = branchId === undefined ? site.branchId : branchId;
    const clientId =
      dto.client_id === undefined
        ? undefined
        : await this.resolveClientId(user, effectiveBranchId, dto.client_id);

    const updatedSite = await this.prisma.site.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.address !== undefined ? { address: dto.address } : {}),
        ...(dto.instructions !== undefined ? { instructions: dto.instructions } : {}),
        ...(clientId !== undefined ? { clientId } : {}),
        ...(branchId !== undefined ? { branchId } : {}),
      },
      include: {
        branch: {
          select: { id: true, name: true, location: true, status: true },
        },
        client: {
          select: { id: true, name: true, companyName: true },
        },
      },
    });

    await this.auditService.log({
      tenantId: user.tenantId,
      userId: user.sub,
      action: 'SITE_UPDATED',
      entityType: 'Site',
      entityId: site.id,
      details: `Site "${site.name}" updated`,
    });

    return updatedSite;
  }
}
