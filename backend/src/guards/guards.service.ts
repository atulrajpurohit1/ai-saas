import { BadRequestException, Injectable, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { branchScopedWhere, branchWhere, resolveWriteBranchId } from '../branches/branch-scope';
import { CreateGuardDto } from './dto/create-guard.dto';
import { UpdateGuardDto } from './dto/update-guard.dto';
import { UpdateAvailabilityDto } from './dto/update-availability.dto';
import * as bcrypt from 'bcrypt';
import { WebhooksService } from '../webhooks/webhooks.service';

@Injectable()
export class GuardsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private webhooksService: WebhooksService,
  ) {}

  private normalizeContact(dto: CreateGuardDto | UpdateGuardDto) {
    const phone = dto.phone?.trim() || undefined;
    const email = dto.email?.trim().toLowerCase() || undefined;

    return { phone, email };
  }

  private withoutPasswordHash<T extends { passwordHash?: string | null }>(guard: T) {
    const { passwordHash, ...safeGuard } = guard;
    return safeGuard;
  }

  async create(user: ActiveUser, dto: CreateGuardDto) {
    const name = dto.name?.trim();
    const { phone, email } = this.normalizeContact(dto);
    const branchId = resolveWriteBranchId(user, dto.branch_id);

    if (!name) {
      throw new BadRequestException('Guard name is required');
    }

    if (!phone && !email) {
      throw new BadRequestException('Guard phone or email is required');
    }

    const passwordHash = dto.password ? await bcrypt.hash(dto.password, 10) : undefined;

    const guard = await this.prisma.guard.create({
      data: {
        name,
        phone,
        email,
        passwordHash,
        tenantId: user.tenantId,
        branchId,
      },
    });

    await this.auditService.log({
      tenantId: user.tenantId,
      userId: user.sub,
      action: 'GUARD_CREATED',
      entityType: 'Guard',
      entityId: guard.id,
      details: `Guard "${guard.name}" created`,
    });

    const safeGuard = this.withoutPasswordHash(guard);
    await this.webhooksService.triggerEvent(user.tenantId, 'guard.created', { guard: safeGuard });

    return safeGuard;
  }

  async findAll(user: ActiveUser, requestedBranchId?: string | null) {
    try {
      const guards = await this.prisma.guard.findMany({
        where: branchScopedWhere(user, requestedBranchId),
        include: {
          branch: {
            select: { id: true, name: true, location: true, status: true },
          },
          availability: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      return guards.map((guard) => this.withoutPasswordHash(guard));
    } catch (error) {
      console.error('Guards findAll error:', error.message);
      throw new InternalServerErrorException(
        'Failed to fetch guards. The database may be unavailable.',
      );
    }
  }

  async update(user: ActiveUser, id: string, dto: UpdateGuardDto) {
    const guard = await this.prisma.guard.findFirst({
      where: { id, tenantId: user.tenantId, ...branchWhere(user) },
    });

    if (!guard) {
      throw new NotFoundException('Guard not found');
    }

    const { phone, email } = this.normalizeContact(dto);
    const branchId =
      dto.branch_id === undefined
        ? undefined
        : resolveWriteBranchId(user, dto.branch_id);
    const data = {
      ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
      ...(dto.phone !== undefined ? { phone } : {}),
      ...(dto.email !== undefined ? { email } : {}),
      ...(dto.password ? { passwordHash: await bcrypt.hash(dto.password, 10) } : {}),
      ...(branchId !== undefined ? { branchId } : {}),
    };

    if (data.name !== undefined && !data.name) {
      throw new BadRequestException('Guard name is required');
    }

    const updatedGuard = await this.prisma.guard.update({
      where: { id },
      data,
    });

    await this.auditService.log({
      tenantId: user.tenantId,
      userId: user.sub,
      action: 'GUARD_UPDATED',
      entityType: 'Guard',
      entityId: guard.id,
      details: `Guard "${guard.name}" updated`,
    });

    return this.withoutPasswordHash(updatedGuard);
  }

  async getAvailability(user: ActiveUser, id: string) {
    const guard = await this.prisma.guard.findFirst({
      where: { id, tenantId: user.tenantId, ...branchWhere(user) },
    });

    if (!guard) {
      throw new NotFoundException('Guard not found');
    }

    const availability = await this.prisma.availability.findFirst({
      where: { guardId: id, tenantId: user.tenantId },
    });

    if (!availability) {
      // Default to available if no record exists
      return { status: 'available' };
    }

    return availability;
  }

  async updateAvailability(user: ActiveUser, id: string, dto: UpdateAvailabilityDto) {
    const guard = await this.prisma.guard.findFirst({
      where: { id, tenantId: user.tenantId, ...branchWhere(user) },
    });

    if (!guard) {
      throw new NotFoundException('Guard not found');
    }

    const availability = await this.prisma.availability.upsert({
      where: { guardId: id },
      update: {
        status: dto.status,
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        endDate: dto.endDate ? new Date(dto.endDate) : null,
      },
      create: {
        guardId: id,
        tenantId: user.tenantId,
        status: dto.status,
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        endDate: dto.endDate ? new Date(dto.endDate) : null,
      },
    });

    await this.auditService.log({
      tenantId: user.tenantId,
      userId: user.sub,
      action: 'AVAILABILITY_UPDATED',
      entityType: 'Guard',
      entityId: id,
      details: `Guard "${guard.name}" availability set to ${dto.status}`,
    });

    return availability;
  }
}
