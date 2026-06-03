import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';

@Injectable()
export class BranchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(user: ActiveUser, dto: CreateBranchDto) {
    this.assertSuperAdmin(user);

    const name = dto.name?.trim();
    const location = dto.location?.trim();
    const managerId = await this.resolveManagerId(user.tenantId, dto.manager_id);

    if (!name || !location) {
      throw new BadRequestException('Branch name and location are required');
    }

    const branch = await this.prisma.branch.create({
      data: {
        tenantId: user.tenantId,
        name,
        location,
        managerId,
        status: dto.status || 'active',
      },
      include: this.branchInclude(),
    });

    if (managerId) {
      await this.prisma.user.update({
        where: { id: managerId },
        data: {
          branchId: branch.id,
          isSuperAdmin: false,
        },
      });
    }

    await this.auditService.log({
      tenantId: user.tenantId,
      userId: user.sub,
      action: 'BRANCH_CREATED',
      entityType: 'Branch',
      entityId: branch.id,
      details: `Branch "${branch.name}" created`,
    });

    return branch;
  }

  async findAll(user: ActiveUser) {
    return this.prisma.branch.findMany({
      where: {
        tenantId: user.tenantId,
        ...(user.isSuperAdmin ? {} : { id: user.branchId || '__none__' }),
      },
      include: this.branchInclude(),
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async findOne(user: ActiveUser, id: string) {
    this.assertBranchAccess(user, id);

    const branch = await this.prisma.branch.findFirst({
      where: { id, tenantId: user.tenantId },
      include: {
        ...this.branchInclude(),
        _count: {
          select: {
            clients: true,
            sites: true,
            guards: true,
            shifts: true,
            incidents: true,
            invoices: true,
            reports: true,
            users: true,
          },
        },
      },
    });

    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    return branch;
  }

  async update(user: ActiveUser, id: string, dto: UpdateBranchDto) {
    this.assertSuperAdmin(user);

    const branch = await this.prisma.branch.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    const managerId =
      dto.manager_id === undefined
        ? undefined
        : await this.resolveManagerId(user.tenantId, dto.manager_id);

    const updated = await this.prisma.branch.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.location !== undefined ? { location: dto.location.trim() } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(managerId !== undefined ? { managerId } : {}),
      },
      include: this.branchInclude(),
    });

    if (managerId) {
      await this.prisma.user.update({
        where: { id: managerId },
        data: {
          branchId: id,
          isSuperAdmin: false,
        },
      });
    }

    await this.auditService.log({
      tenantId: user.tenantId,
      userId: user.sub,
      action: 'BRANCH_UPDATED',
      entityType: 'Branch',
      entityId: id,
      details: `Branch "${updated.name}" updated`,
    });

    return updated;
  }

  private branchInclude() {
    return {
      manager: {
        select: {
          id: true,
          name: true,
          email: true,
          branchId: true,
          isSuperAdmin: true,
        },
      },
    };
  }

  private async resolveManagerId(tenantId: string, managerId?: string | null) {
    const normalized = managerId?.trim() || null;
    if (!normalized) return null;

    const manager = await this.prisma.user.findFirst({
      where: {
        id: normalized,
        tenantId,
      },
      select: { id: true, role: true },
    });

    if (!manager) {
      throw new BadRequestException('Branch manager must belong to this tenant');
    }

    return manager.id;
  }

  private assertSuperAdmin(user: ActiveUser) {
    if (!user.isSuperAdmin) {
      throw new ForbiddenException('Only super admins can manage branches');
    }
  }

  private assertBranchAccess(user: ActiveUser, branchId: string) {
    if (!user.isSuperAdmin && user.branchId !== branchId) {
      throw new ForbiddenException('You do not have access to this branch');
    }
  }
}
