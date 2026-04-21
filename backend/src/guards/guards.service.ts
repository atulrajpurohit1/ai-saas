import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateGuardDto } from './dto/create-guard.dto';
import { UpdateGuardDto } from './dto/update-guard.dto';

@Injectable()
export class GuardsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async create(userId: string, tenantId: string, dto: CreateGuardDto) {
    const guard = await this.prisma.guard.create({
      data: {
        ...dto,
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

    return guard;
  }

  async findAll(tenantId: string) {
    return this.prisma.guard.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async update(userId: string, tenantId: string, id: string, dto: UpdateGuardDto) {
    const guard = await this.prisma.guard.findFirst({
      where: { id, tenantId },
    });

    if (!guard) {
      throw new NotFoundException('Guard not found');
    }

    const updatedGuard = await this.prisma.guard.update({
      where: { id },
      data: dto,
    });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'GUARD_UPDATED',
      entityType: 'Guard',
      entityId: guard.id,
      details: `Guard "${guard.name}" updated`,
    });

    return updatedGuard;
  }
}
