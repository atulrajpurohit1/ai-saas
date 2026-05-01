import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateShiftDto } from './dto/create-shift.dto';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class ShiftsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async create(userId: string, tenantId: string, dto: CreateShiftDto) {
    // 1. Verify site exists and belongs to the same tenant
    const site = await this.prisma.site.findUnique({
      where: { id: dto.siteId },
    });

    if (!site) {
      throw new NotFoundException('Site not found');
    }

    if (site.tenantId !== tenantId) {
      throw new ForbiddenException('You do not have access to this site');
    }

    // 2. Create the shift
    const shift = await this.prisma.shift.create({
      data: {
        siteId: dto.siteId,
        startTime: new Date(dto.startTime),
        endTime: new Date(dto.endTime),
        requiredGuards: dto.requiredGuards,
        tenantId: tenantId,
        status: 'open',
      },
      include: {
        site: {
          select: { name: true }
        }
      }
    });

    // 3. Log audit event
    await this.auditService.log({
      tenantId,
      userId,
      action: 'SHIFT_CREATED',
      entityType: 'Shift',
      entityId: shift.id,
      details: `Shift created for site "${site.name}" (${dto.requiredGuards} guards)`,
    });

    return shift;
  }

  async findAll(tenantId: string) {
    return this.prisma.shift.findMany({
      where: { tenantId },
      include: {
        site: {
          select: {
            name: true,
          },
        },
        assignments: {
          include: {
            guard: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        startTime: 'desc',
      },
    });
  }

  async assign(userId: string, tenantId: string, shiftId: string, guardId: string) {
    // 1. Validate shift exists and belongs to tenant
    const shift = await this.prisma.shift.findUnique({
      where: { id: shiftId },
      include: { assignments: true },
    });

    if (!shift) throw new NotFoundException('Shift not found');
    if (shift.tenantId !== tenantId) throw new ForbiddenException('Access denied');

    // 2. Validate guard exists and belongs to tenant
    const guard = await this.prisma.guard.findUnique({
      where: { id: guardId },
    });

    if (!guard) throw new NotFoundException('Guard not found');
    if (guard.tenantId !== tenantId) throw new ForbiddenException('Access denied');

    // 3. Check guard availability
    const availability = await this.prisma.availability.findUnique({
      where: { guardId },
    });

    if (availability && availability.status === 'unavailable') {
      await this.auditService.log({
        tenantId,
        userId,
        action: 'ASSIGNMENT_REJECTED',
        entityType: 'Shift',
        entityId: shiftId,
        details: `Assignment of guard "${guard.name}" rejected due to unavailability`,
      });
      throw new ForbiddenException('Guard is currently unavailable');
    }

    // 4. Simple rule: reject if already assigned (could be replaced but following "reject for now")
    if (shift.assignments.length > 0) {
      throw new ForbiddenException('Shift is already assigned');
    }

    // 4. Create assignment and update shift status in a transaction
    const result = await this.prisma.$transaction(async (tx) => {
      const assignment = await tx.assignment.create({
        data: {
          shiftId,
          guardId,
          status: 'pending',
        },
      });

      await tx.shift.update({
        where: { id: shiftId },
        data: { status: 'assigned' },
      });

      return assignment;
    });

    // 5. Audit log
    await this.auditService.log({
      tenantId,
      userId,
      action: 'GUARD_ASSIGNED',
      entityType: 'Shift',
      entityId: shiftId,
      details: `Guard "${guard.name}" assigned to shift at "${shiftId}"`,
    });

    // 6. Basic Notification
    console.log(`[NOTIFICATION] Guard "${guard.name}" assigned to Shift #${shiftId}`);

    return result;
  }

  async unassign(userId: string, tenantId: string, shiftId: string) {
    // 1. Validate shift exists and belongs to tenant
    const shift = await this.prisma.shift.findUnique({
      where: { id: shiftId },
      include: { assignments: true },
    });

    if (!shift) throw new NotFoundException('Shift not found');
    if (shift.tenantId !== tenantId) throw new ForbiddenException('Access denied');

    if (shift.assignments.length === 0) {
      throw new NotFoundException('No assignment found for this shift');
    }

    // 2. Delete assignments and update shift status
    await this.prisma.$transaction(async (tx) => {
      await tx.assignment.deleteMany({
        where: { shiftId },
      });

      await tx.shift.update({
        where: { id: shiftId },
        data: { status: 'open' },
      });
    });

    // 3. Audit log
    await this.auditService.log({
      tenantId,
      userId,
      action: 'GUARD_UNASSIGNED',
      entityType: 'Shift',
      entityId: shiftId,
      details: `Guard unassigned from shift "${shiftId}"`,
    });

    // 4. Basic Notification
    console.log(`[NOTIFICATION] Guard unassigned from Shift #${shiftId}`);

    return { message: 'Guard unassigned successfully' };
  }
}
