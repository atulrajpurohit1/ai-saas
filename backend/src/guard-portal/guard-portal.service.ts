import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GuardPortalService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async getProfile(tenantId: string, guardId: string) {
    const guard = await this.prisma.guard.findFirst({
      where: { id: guardId, tenantId },
      include: { availability: true },
    });

    if (!guard) {
      throw new NotFoundException('Guard profile not found');
    }

    return {
      id: guard.id,
      name: guard.name,
      phone: guard.phone,
      email: guard.email,
      availabilityStatus: guard.availability?.status || 'available',
    };
  }

  async getAssignedShifts(tenantId: string, guardId: string) {
    await this.getProfile(tenantId, guardId);

    const assignments = await this.prisma.assignment.findMany({
      where: {
        guardId,
        shift: { tenantId },
      },
      include: {
        shift: {
          include: {
            site: true,
          },
        },
      },
    });

    return assignments
      .sort((left, right) => left.shift.startTime.getTime() - right.shift.startTime.getTime())
      .map((assignment) => ({
        id: assignment.shift.id,
        shiftId: assignment.shift.id,
        siteName: assignment.shift.site.name,
        siteAddress: assignment.shift.site.address,
        startTime: assignment.shift.startTime,
        endTime: assignment.shift.endTime,
        status: assignment.shift.status,
        assignmentStatus: assignment.status,
      }));
  }

  async getShiftDetail(tenantId: string, guardId: string, shiftId: string) {
    const assignment = await this.prisma.assignment.findFirst({
      where: {
        guardId,
        shiftId,
        shift: { tenantId },
      },
      include: {
        guard: true,
        shift: {
          include: {
            site: true,
          },
        },
      },
    });

    if (!assignment) {
      throw new ForbiddenException('You do not have access to this shift');
    }

    await this.auditService.log({
      tenantId,
      userId: guardId,
      action: 'GUARD_SHIFT_VIEWED',
      entityType: 'Shift',
      entityId: shiftId,
      details: `Guard "${assignment.guard.name}" viewed assigned shift`,
    });

    return {
      id: assignment.shift.id,
      shiftId: assignment.shift.id,
      startTime: assignment.shift.startTime,
      endTime: assignment.shift.endTime,
      status: assignment.shift.status,
      assignmentStatus: assignment.status,
      site: {
        id: assignment.shift.site.id,
        name: assignment.shift.site.name,
        address: assignment.shift.site.address,
        instructions: assignment.shift.site.instructions,
      },
      assignedGuard: {
        id: assignment.guard.id,
        name: assignment.guard.name,
        phone: assignment.guard.phone,
        email: assignment.guard.email,
      },
    };
  }
}
