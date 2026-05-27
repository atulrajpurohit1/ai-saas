import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';

type AttendanceStatus = 'not_started' | 'checked_in' | 'completed';

type AttendanceEventSummary = {
  type: string;
  timestamp: Date;
};

@Injectable()
export class GuardPortalService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  private summarizeAttendance(events: AttendanceEventSummary[]): {
    attendanceStatus: AttendanceStatus;
    checkInTime: Date | null;
    checkOutTime: Date | null;
  } {
    const checkIn = events.find((event) => event.type === 'CHECK_IN');
    const checkOut = events.find((event) => event.type === 'CHECK_OUT');

    return {
      attendanceStatus: checkOut ? 'completed' : checkIn ? 'checked_in' : 'not_started',
      checkInTime: checkIn?.timestamp ?? null,
      checkOutTime: checkOut?.timestamp ?? null,
    };
  }

  private async logInvalidAttendanceAttempt(data: {
    tenantId: string;
    guardId: string;
    shiftId: string;
    action: 'CHECK_IN' | 'CHECK_OUT';
    reason: string;
  }) {
    await this.auditService.log({
      tenantId: data.tenantId,
      userId: data.guardId,
      action: data.action === 'CHECK_IN' ? 'GUARD_CHECK_IN_INVALID' : 'GUARD_CHECK_OUT_INVALID',
      entityType: 'Shift',
      entityId: data.shiftId,
      details: data.reason,
    });
  }

  private isDuplicateAttendanceEvent(error: unknown) {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }

  private roundHours(value: number) {
    return Math.round(value * 10) / 10;
  }

  private async getAssignedShiftContext(
    tenantId: string,
    guardId: string,
    shiftId: string,
    auditAction?: 'CHECK_IN' | 'CHECK_OUT',
  ) {
    const shift = await this.prisma.shift.findFirst({
      where: { id: shiftId, tenantId },
      include: {
        site: true,
        assignments: {
          where: { guardId },
          include: { guard: true },
        },
        attendanceEvents: {
          where: { guardId, tenantId },
          orderBy: { timestamp: 'asc' },
        },
      },
    });

    if (!shift) {
      if (auditAction) {
        await this.logInvalidAttendanceAttempt({
          tenantId,
          guardId,
          shiftId,
          action: auditAction,
          reason: 'Shift not found',
        });
      }
      throw new NotFoundException('Shift not found');
    }

    const assignment = shift.assignments[0];
    if (!assignment) {
      if (auditAction) {
        await this.logInvalidAttendanceAttempt({
          tenantId,
          guardId,
          shiftId,
          action: auditAction,
          reason: 'Shift is not assigned to this guard',
        });
      }
      throw new ForbiddenException('Shift is not assigned to this guard');
    }

    return { shift, assignment };
  }

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
            attendanceEvents: {
              where: { guardId, tenantId },
              orderBy: { timestamp: 'asc' },
            },
          },
        },
      },
    });

    return assignments
      .sort((left, right) => left.shift.startTime.getTime() - right.shift.startTime.getTime())
      .map((assignment) => {
        const attendance = this.summarizeAttendance(assignment.shift.attendanceEvents);

        return {
          id: assignment.shift.id,
          shiftId: assignment.shift.id,
          siteName: assignment.shift.site.name,
          siteAddress: assignment.shift.site.address,
          startTime: assignment.shift.startTime,
          endTime: assignment.shift.endTime,
          status: assignment.shift.status,
          assignmentStatus: assignment.status,
          attendanceStatus: attendance.attendanceStatus,
          checkInTime: attendance.checkInTime,
          checkOutTime: attendance.checkOutTime,
        };
      });
  }

  async getShiftDetail(tenantId: string, guardId: string, shiftId: string) {
    const { shift, assignment } = await this.getAssignedShiftContext(tenantId, guardId, shiftId);
    const attendance = this.summarizeAttendance(shift.attendanceEvents);

    await this.auditService.log({
      tenantId,
      userId: guardId,
      action: 'GUARD_SHIFT_VIEWED',
      entityType: 'Shift',
      entityId: shiftId,
      details: `Guard "${assignment.guard.name}" viewed assigned shift`,
    });

    return {
      id: shift.id,
      shiftId: shift.id,
      startTime: shift.startTime,
      endTime: shift.endTime,
      status: shift.status,
      assignmentStatus: assignment.status,
      attendanceStatus: attendance.attendanceStatus,
      checkInTime: attendance.checkInTime,
      checkOutTime: attendance.checkOutTime,
      site: {
        id: shift.site.id,
        name: shift.site.name,
        address: shift.site.address,
        instructions: shift.site.instructions,
      },
      assignedGuard: {
        id: assignment.guard.id,
        name: assignment.guard.name,
        phone: assignment.guard.phone,
        email: assignment.guard.email,
      },
    };
  }

  async checkIn(tenantId: string, guardId: string, shiftId: string) {
    const { shift, assignment } = await this.getAssignedShiftContext(tenantId, guardId, shiftId, 'CHECK_IN');
    const attendance = this.summarizeAttendance(shift.attendanceEvents);

    if (attendance.checkInTime) {
      await this.logInvalidAttendanceAttempt({
        tenantId,
        guardId,
        shiftId,
        action: 'CHECK_IN',
        reason: 'Guard has already checked in for this shift',
      });
      throw new BadRequestException('Guard has already checked in for this shift');
    }

    if (attendance.checkOutTime) {
      await this.logInvalidAttendanceAttempt({
        tenantId,
        guardId,
        shiftId,
        action: 'CHECK_IN',
        reason: 'Guard has already checked out for this shift',
      });
      throw new BadRequestException('Guard has already checked out for this shift');
    }

    try {
      const event = await this.prisma.$transaction(async (tx) => {
        const attendanceEvent = await tx.attendanceEvent.create({
          data: {
            tenantId,
            guardId,
            shiftId,
            type: 'CHECK_IN',
            source: 'guard_portal',
          },
        });

        await tx.shift.update({
          where: { id: shiftId },
          data: { status: 'in_progress' },
        });

        return attendanceEvent;
      });

      await this.auditService.log({
        tenantId,
        userId: guardId,
        action: 'GUARD_CHECKED_IN',
        entityType: 'Shift',
        entityId: shiftId,
        details: `Guard "${assignment.guard.name}" checked in`,
      });

      return {
        message: 'Checked in successfully',
        shiftStatus: 'in_progress',
        attendanceStatus: 'checked_in',
        checkInTime: event.timestamp,
        checkOutTime: null,
      };
    } catch (error) {
      if (this.isDuplicateAttendanceEvent(error)) {
        await this.logInvalidAttendanceAttempt({
          tenantId,
          guardId,
          shiftId,
          action: 'CHECK_IN',
          reason: 'Guard has already checked in for this shift',
        });
        throw new BadRequestException('Guard has already checked in for this shift');
      }

      throw error;
    }
  }

  async checkOut(tenantId: string, guardId: string, shiftId: string) {
    const { shift, assignment } = await this.getAssignedShiftContext(tenantId, guardId, shiftId, 'CHECK_OUT');
    const attendance = this.summarizeAttendance(shift.attendanceEvents);

    if (attendance.checkOutTime) {
      await this.logInvalidAttendanceAttempt({
        tenantId,
        guardId,
        shiftId,
        action: 'CHECK_OUT',
        reason: 'Guard has already checked out for this shift',
      });
      throw new BadRequestException('Guard has already checked out for this shift');
    }

    if (!attendance.checkInTime) {
      await this.logInvalidAttendanceAttempt({
        tenantId,
        guardId,
        shiftId,
        action: 'CHECK_OUT',
        reason: 'Guard must check in before checking out',
      });
      throw new BadRequestException('Guard must check in before checking out');
    }

    const checkInTime = attendance.checkInTime;

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const attendanceEvent = await tx.attendanceEvent.create({
          data: {
            tenantId,
            guardId,
            shiftId,
            type: 'CHECK_OUT',
            source: 'guard_portal',
          },
        });

        await tx.shift.update({
          where: { id: shiftId },
          data: { status: 'completed' },
        });

        const totalHours = this.roundHours(
          Math.max(0, (attendanceEvent.timestamp.getTime() - checkInTime.getTime()) / 3_600_000),
        );

        const timesheet = await tx.timesheet.upsert({
          where: {
            tenantId_shiftId_guardId: {
              tenantId,
              shiftId,
              guardId,
            },
          },
          update: {
            siteId: shift.siteId,
            clientId: shift.site.clientId,
            checkInTime,
            checkOutTime: attendanceEvent.timestamp,
            totalHours,
            status: 'pending',
            approvedBy: null,
            approvedAt: null,
            rejectionReason: null,
          },
          create: {
            tenantId,
            guardId,
            shiftId,
            siteId: shift.siteId,
            clientId: shift.site.clientId,
            checkInTime,
            checkOutTime: attendanceEvent.timestamp,
            totalHours,
            status: 'pending',
          },
        });

        return { attendanceEvent, timesheet };
      });

      await this.auditService.log({
        tenantId,
        userId: guardId,
        action: 'GUARD_CHECKED_OUT',
        entityType: 'Shift',
        entityId: shiftId,
        details: `Guard "${assignment.guard.name}" checked out`,
      });

      return {
        message: 'Checked out successfully',
        shiftStatus: 'completed',
        attendanceStatus: 'completed',
        checkInTime,
        checkOutTime: result.attendanceEvent.timestamp,
        timesheetId: result.timesheet.id,
        timesheetStatus: result.timesheet.status,
        totalHours: result.timesheet.totalHours,
      };
    } catch (error) {
      if (this.isDuplicateAttendanceEvent(error)) {
        await this.logInvalidAttendanceAttempt({
          tenantId,
          guardId,
          shiftId,
          action: 'CHECK_OUT',
          reason: 'Guard has already checked out for this shift',
        });
        throw new BadRequestException('Guard has already checked out for this shift');
      }

      throw error;
    }
  }
}
