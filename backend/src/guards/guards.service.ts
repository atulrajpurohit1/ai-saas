import { BadRequestException, Injectable, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateGuardDto } from './dto/create-guard.dto';
import { UpdateGuardDto } from './dto/update-guard.dto';
import { UpdateAvailabilityDto } from './dto/update-availability.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class GuardsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
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

  async create(userId: string, tenantId: string, dto: CreateGuardDto) {
    const name = dto.name?.trim();
    const { phone, email } = this.normalizeContact(dto);

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
        tenantId,
      },
    });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'GUARD_CREATED',
      entityType: 'Guard',
      entityId: guard.id,
      details: `Guard "${guard.name}" created`,
    });

    return this.withoutPasswordHash(guard);
  }

  async findAll(tenantId: string) {
    try {
      const guards = await this.prisma.guard.findMany({
        where: { tenantId },
        include: {
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

  async update(userId: string, tenantId: string, id: string, dto: UpdateGuardDto) {
    const guard = await this.prisma.guard.findFirst({
      where: { id, tenantId },
    });

    if (!guard) {
      throw new NotFoundException('Guard not found');
    }

    const { phone, email } = this.normalizeContact(dto);
    const data = {
      ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
      ...(dto.phone !== undefined ? { phone } : {}),
      ...(dto.email !== undefined ? { email } : {}),
      ...(dto.password ? { passwordHash: await bcrypt.hash(dto.password, 10) } : {}),
    };

    if (data.name !== undefined && !data.name) {
      throw new BadRequestException('Guard name is required');
    }

    const updatedGuard = await this.prisma.guard.update({
      where: { id },
      data,
    });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'GUARD_UPDATED',
      entityType: 'Guard',
      entityId: guard.id,
      details: `Guard "${guard.name}" updated`,
    });

    return this.withoutPasswordHash(updatedGuard);
  }

  async getAvailability(tenantId: string, id: string) {
    const guard = await this.prisma.guard.findFirst({
      where: { id, tenantId },
    });

    if (!guard) {
      throw new NotFoundException('Guard not found');
    }

    const availability = await this.prisma.availability.findFirst({
      where: { guardId: id, tenantId },
    });

    if (!availability) {
      // Default to available if no record exists
      return { status: 'available' };
    }

    return availability;
  }

  async updateAvailability(userId: string, tenantId: string, id: string, dto: UpdateAvailabilityDto) {
    const guard = await this.prisma.guard.findFirst({
      where: { id, tenantId },
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
        tenantId,
        status: dto.status,
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        endDate: dto.endDate ? new Date(dto.endDate) : null,
      },
    });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'AVAILABILITY_UPDATED',
      entityType: 'Guard',
      entityId: id,
      details: `Guard "${guard.name}" availability set to ${dto.status}`,
    });

    return availability;
  }
}
