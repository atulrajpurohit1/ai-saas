import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateShiftDto } from './dto/create-shift.dto';
import { AuditService } from '../audit/audit.service';
import { RecommendationService } from '../ai-insights/recommendation.service';
import { GuardRecommendation } from '../ai-insights/ai-insights.types';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import {
  branchScopedWhere,
  branchWhere,
  resolveWriteBranchId,
} from '../branches/branch-scope';
import { WebhooksService } from '../webhooks/webhooks.service';
import { EmailService } from '../email/email.service';
import { isNoShow, staffingStatus } from './shift-staffing';
import { UpdateShiftDto } from './dto/update-shift.dto';

type AttendanceStatus = 'not_started' | 'checked_in' | 'completed';

type AttendanceEventSummary = {
  type: string;
  timestamp: Date;
  guardId?: string;
};

@Injectable()
export class ShiftsService {
  private readonly logger = new Logger(ShiftsService.name);

  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private recommendationService: RecommendationService,
    private webhooksService: WebhooksService,
    private emailService: EmailService,
  ) {}

  /**
   * Emails a guard about a roster change. Best-effort by contract: the change
   * is already committed, so a mail failure is audited and logged but never
   * thrown -- a scheduler must not see "assignment failed" because SMTP is
   * down. A guard with no email address is recorded as unreachable, which is
   * what the admin UI tells the scheduler to handle by hand.
   */
  private async notifyGuardOfShiftChange(
    user: ActiveUser,
    change: 'assigned' | 'unassigned' | 'updated',
    shift: {
      id: string;
      startTime: Date;
      endTime: Date;
      site: { name: string; address?: string | null };
    },
    guard: { id: string; name: string; email?: string | null },
  ) {
    if (!guard.email?.trim()) {
      await this.auditService.log({
        tenantId: user.tenantId,
        userId: user.sub,
        action: 'GUARD_NOTIFY_SKIPPED',
        entityType: 'Shift',
        entityId: shift.id,
        details: `Guard "${guard.name}" has no email address; ${change} notification not sent`,
      });
      return;
    }

    try {
      await this.emailService.sendShiftAssignmentEmail(user.tenantId, {
        email: guard.email.trim(),
        guardName: guard.name,
        siteName: shift.site.name,
        siteAddress: shift.site.address ?? null,
        startTime: shift.startTime,
        endTime: shift.endTime,
        change,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to email guard ${guard.id} about shift ${shift.id} (${change}): ${message}`,
      );
      await this.auditService.log({
        tenantId: user.tenantId,
        userId: user.sub,
        action: 'GUARD_NOTIFY_FAILED',
        entityType: 'Shift',
        entityId: shift.id,
        details: `Could not email guard "${guard.name}" about being ${change}: ${message}`,
      });
    }
  }

  private summarizeAttendance(events: AttendanceEventSummary[]): {
    attendanceStatus: AttendanceStatus;
    checkInTime: Date | null;
    checkOutTime: Date | null;
  } {
    const checkIn = events.find((event) => event.type === 'CHECK_IN');
    const checkOut = events.find((event) => event.type === 'CHECK_OUT');

    return {
      attendanceStatus: checkOut
        ? 'completed'
        : checkIn
          ? 'checked_in'
          : 'not_started',
      checkInTime: checkIn?.timestamp ?? null,
      checkOutTime: checkOut?.timestamp ?? null,
    };
  }

  async create(user: ActiveUser, dto: CreateShiftDto) {
    const branchId = resolveWriteBranchId(user, dto.branch_id);
    // 1. Verify site exists and belongs to the same tenant
    const site = await this.prisma.site.findFirst({
      where: { id: dto.siteId, tenantId: user.tenantId, ...branchWhere(user) },
    });

    if (!site) {
      throw new NotFoundException('Site not found');
    }

    if (branchId && site.branchId && site.branchId !== branchId) {
      throw new ForbiddenException('Site must belong to the selected branch');
    }

    // 2. Create the shift
    const shift = await this.prisma.shift.create({
      data: {
        siteId: dto.siteId,
        startTime: new Date(dto.startTime),
        endTime: new Date(dto.endTime),
        requiredGuards: dto.requiredGuards,
        tenantId: user.tenantId,
        branchId: branchId ?? site.branchId,
        status: 'open',
      },
      include: {
        site: {
          select: { name: true },
        },
      },
    });

    // 3. Log audit event
    await this.auditService.log({
      tenantId: user.tenantId,
      userId: user.sub,
      action: 'SHIFT_CREATED',
      entityType: 'Shift',
      entityId: shift.id,
      details: `Shift created for site "${site.name}" (${dto.requiredGuards} guards)`,
    });

    await this.webhooksService.triggerEvent(user.tenantId, 'shift.created', {
      shift,
    });

    return shift;
  }

  async findAll(user: ActiveUser, requestedBranchId?: string | null) {
    try {
      const shifts = await this.prisma.shift.findMany({
        where: branchScopedWhere(user, requestedBranchId),
        include: {
          branch: {
            select: { id: true, name: true, location: true, status: true },
          },
          site: {
            select: {
              name: true,
            },
          },
          assignments: {
            orderBy: { createdAt: 'asc' },
            include: {
              guard: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          attendanceEvents: {
            orderBy: {
              timestamp: 'asc',
            },
          },
        },
        orderBy: {
          startTime: 'desc',
        },
      });

      // Attendance is reported per assignment, not per shift. With several
      // guards on one shift, a shift-level "checked in" only ever meant
      // "somebody checked in"; the UI derives any roll-up it needs.
      const now = new Date();

      return shifts.map((shift) => {
        const { attendanceEvents, assignments, ...shiftWithoutEvents } = shift;

        return {
          ...shiftWithoutEvents,
          assignments: assignments.map((assignment) => {
            const attendance = this.summarizeAttendance(
              attendanceEvents.filter(
                (event) => event.guardId === assignment.guardId,
              ),
            );

            return {
              ...assignment,
              ...attendance,
              noShow: isNoShow(shift, Boolean(attendance.checkInTime), now),
            };
          }),
        };
      });
    } catch (error) {
      console.error('Shifts findAll error:', error.message);
      throw new InternalServerErrorException(
        'Failed to fetch shifts. The database may be unavailable.',
      );
    }
  }

  async recommendGuards(user: ActiveUser, shiftId: string) {
    const shift = await this.prisma.shift.findFirst({
      where: { id: shiftId, tenantId: user.tenantId, ...branchWhere(user) },
      select: { id: true },
    });

    if (!shift) {
      throw new NotFoundException('Shift not found');
    }

    const recommendations = await this.recommendationService.recommendGuards(
      user.tenantId,
      shiftId,
      true,
    );

    await this.auditService.log({
      tenantId: user.tenantId,
      userId: user.sub,
      action: 'GUARD_RECOMMENDATIONS_GENERATED',
      entityType: 'Shift',
      entityId: shiftId,
      details: `${recommendations.length} guard recommendations generated`,
    });

    return recommendations;
  }

  async assign(user: ActiveUser, shiftId: string, guardId: string) {
    // 1. Validate shift exists and belongs to tenant
    const shift = await this.prisma.shift.findFirst({
      where: { id: shiftId, tenantId: user.tenantId, ...branchWhere(user) },
      include: {
        assignments: true,
        site: { select: { name: true, address: true } },
      },
    });

    if (!shift) throw new NotFoundException('Shift not found');

    // 2. Validate guard exists and belongs to tenant
    const guard = await this.prisma.guard.findFirst({
      where: { id: guardId, tenantId: user.tenantId, ...branchWhere(user) },
    });

    if (!guard) throw new NotFoundException('Guard not found');
    if (guard.deactivatedAt) {
      throw new BadRequestException('Guard has been deactivated');
    }
    if (shift.branchId && guard.branchId && shift.branchId !== guard.branchId) {
      throw new ForbiddenException(
        'Guard and shift must belong to the same branch',
      );
    }

    // 3. Check guard availability
    const availability = await this.prisma.availability.findUnique({
      where: { guardId },
    });

    if (availability && availability.status === 'unavailable') {
      await this.auditService.log({
        tenantId: user.tenantId,
        userId: user.sub,
        action: 'ASSIGNMENT_REJECTED',
        entityType: 'Shift',
        entityId: shiftId,
        details: `Assignment of guard "${guard.name}" rejected due to unavailability`,
      });
      throw new ForbiddenException('Guard is currently unavailable');
    }

    // 4. Staffing rules. A shift takes up to `requiredGuards` distinct guards.
    if (
      shift.assignments.some((assignment) => assignment.guardId === guardId)
    ) {
      throw new BadRequestException(
        `${guard.name} is already assigned to this shift`,
      );
    }
    if (shift.assignments.length >= shift.requiredGuards) {
      throw new BadRequestException(
        `Shift is fully staffed (${shift.assignments.length} of ${shift.requiredGuards} guards assigned)`,
      );
    }

    let selectedRecommendation: GuardRecommendation | null = null;
    try {
      const recommendations = await this.recommendationService.recommendGuards(
        user.tenantId,
        shiftId,
        false,
      );
      selectedRecommendation =
        recommendations.find(
          (recommendation) => recommendation.guard_id === guardId,
        ) ?? null;
    } catch (error) {
      console.warn(
        'Failed to evaluate guard recommendation during assignment:',
        error instanceof Error ? error.message : error,
      );
    }

    // 5. Create assignment and recompute the staffing status in a transaction.
    // Guards don't accept or decline shifts (rostering is ad hoc, decided by
    // the scheduler), so an assignment is 'confirmed' from the moment it is
    // made; there is no 'pending' state for anyone to resolve.
    const result = await this.prisma.$transaction(async (tx) => {
      const assignment = await tx.assignment.create({
        data: {
          shiftId,
          guardId,
          status: 'confirmed',
        },
      });

      const assignedCount = await tx.assignment.count({ where: { shiftId } });

      await tx.shift.update({
        where: { id: shiftId },
        data: {
          status: staffingStatus(
            shift.status,
            assignedCount,
            shift.requiredGuards,
          ),
        },
      });

      return { assignment, assignedCount };
    });

    // 6. Audit log
    await this.auditService.log({
      tenantId: user.tenantId,
      userId: user.sub,
      action: 'GUARD_ASSIGNED',
      entityType: 'Shift',
      entityId: shiftId,
      details: `Guard "${guard.name}" assigned to shift "${shiftId}" (${result.assignedCount} of ${shift.requiredGuards} guards)`,
    });

    await this.webhooksService.triggerEvent(user.tenantId, 'shift.assigned', {
      shift_id: shiftId,
      guard_id: guardId,
      assignment: result.assignment,
    });

    if (selectedRecommendation) {
      await this.auditService.log({
        tenantId: user.tenantId,
        userId: user.sub,
        action: 'RECOMMENDED_GUARD_ASSIGNED',
        entityType: 'Shift',
        entityId: shiftId,
        details: `Recommended guard "${guard.name}" assigned with score ${selectedRecommendation.score}`,
      });
    }

    // 7. Tell the guard. Best-effort; see notifyGuardOfShiftChange.
    await this.notifyGuardOfShiftChange(user, 'assigned', shift, guard);

    return result.assignment;
  }

  /**
   * Removes one guard from a shift, or every guard when `guardId` is omitted.
   *
   * A guard who has already checked in cannot be removed: the guard portal
   * only lets an assigned guard check out, so removing them would strand
   * their attendance with no way to close it and no timesheet.
   */
  async unassign(user: ActiveUser, shiftId: string, guardId?: string) {
    // 1. Validate shift exists and belongs to tenant
    const shift = await this.prisma.shift.findFirst({
      where: { id: shiftId, tenantId: user.tenantId, ...branchWhere(user) },
      include: {
        assignments: {
          include: {
            guard: { select: { id: true, name: true, email: true } },
          },
        },
        site: { select: { name: true, address: true } },
        attendanceEvents: {
          where: { type: 'CHECK_IN' },
          select: { guardId: true },
        },
      },
    });

    if (!shift) throw new NotFoundException('Shift not found');

    if (shift.assignments.length === 0) {
      throw new NotFoundException('No assignment found for this shift');
    }

    const checkedInGuardIds = new Set(
      shift.attendanceEvents.map((event) => event.guardId),
    );

    const removing = guardId
      ? shift.assignments.filter((assignment) => assignment.guardId === guardId)
      : shift.assignments;

    if (guardId && removing.length === 0) {
      throw new NotFoundException('This guard is not assigned to this shift');
    }

    const checkedIn = removing.find((assignment) =>
      checkedInGuardIds.has(assignment.guardId),
    );
    if (checkedIn) {
      throw new BadRequestException(
        `${checkedIn.guard.name} has already checked in to this shift and can't be removed`,
      );
    }

    // 2. Delete the assignment(s) and recompute the staffing status
    await this.prisma.$transaction(async (tx) => {
      await tx.assignment.deleteMany({
        where: { id: { in: removing.map((assignment) => assignment.id) } },
      });

      const remaining = await tx.assignment.count({ where: { shiftId } });

      await tx.shift.update({
        where: { id: shiftId },
        data: {
          status: staffingStatus(
            shift.status,
            remaining,
            shift.requiredGuards,
          ),
        },
      });
    });

    const names = removing.map((assignment) => assignment.guard.name);

    // 3. Audit log
    await this.auditService.log({
      tenantId: user.tenantId,
      userId: user.sub,
      action: 'GUARD_UNASSIGNED',
      entityType: 'Shift',
      entityId: shiftId,
      details: `Guard${names.length === 1 ? '' : 's'} "${names.join('", "')}" unassigned from shift "${shiftId}"`,
    });

    // 4. Tell each guard they are off the shift. Best-effort; see
    // notifyGuardOfShiftChange.
    for (const assignment of removing) {
      await this.notifyGuardOfShiftChange(
        user,
        'unassigned',
        shift,
        assignment.guard,
      );
    }

    return { message: 'Guard unassigned successfully' };
  }

  /**
   * Edits a shift.
   *
   * Once a guard has checked in, the times are history: a timesheet is already
   * being measured against them, so only `requiredGuards` may still change.
   * `requiredGuards` can never drop below the number of guards already on the
   * shift -- that would leave it over-staffed with no way to express it.
   */
  async update(user: ActiveUser, shiftId: string, dto: UpdateShiftDto) {
    const shift = await this.prisma.shift.findFirst({
      where: { id: shiftId, tenantId: user.tenantId, ...branchWhere(user) },
      include: {
        assignments: {
          include: {
            guard: { select: { id: true, name: true, email: true } },
          },
        },
        site: { select: { name: true, address: true } },
        attendanceEvents: { select: { id: true } },
      },
    });

    if (!shift) throw new NotFoundException('Shift not found');

    const wantsTimeChange =
      dto.startTime !== undefined ||
      dto.endTime !== undefined ||
      dto.siteId !== undefined;

    if (wantsTimeChange && shift.attendanceEvents.length > 0) {
      throw new BadRequestException(
        'A guard has already checked in to this shift, so its site and times ' +
          'can no longer be changed. You can still change how many guards it needs.',
      );
    }

    if (
      dto.requiredGuards !== undefined &&
      dto.requiredGuards < shift.assignments.length
    ) {
      throw new BadRequestException(
        `This shift already has ${shift.assignments.length} guards assigned. ` +
          'Unassign someone before lowering the number required.',
      );
    }

    const startTime =
      dto.startTime !== undefined ? new Date(dto.startTime) : shift.startTime;
    const endTime =
      dto.endTime !== undefined ? new Date(dto.endTime) : shift.endTime;

    if (endTime.getTime() <= startTime.getTime()) {
      throw new BadRequestException('End time must be after the start time');
    }

    let site = shift.site;
    if (dto.siteId !== undefined && dto.siteId !== shift.siteId) {
      const nextSite = await this.prisma.site.findFirst({
        where: {
          id: dto.siteId,
          tenantId: user.tenantId,
          ...branchWhere(user),
        },
        select: { id: true, name: true, address: true, branchId: true },
      });
      if (!nextSite) throw new NotFoundException('Site not found');
      if (
        shift.branchId &&
        nextSite.branchId &&
        nextSite.branchId !== shift.branchId
      ) {
        throw new ForbiddenException(
          'Site must belong to the same branch as the shift',
        );
      }
      site = { name: nextSite.name, address: nextSite.address };
    }

    const requiredGuards = dto.requiredGuards ?? shift.requiredGuards;

    const updated = await this.prisma.shift.update({
      where: { id: shiftId },
      data: {
        ...(dto.siteId !== undefined ? { siteId: dto.siteId } : {}),
        startTime,
        endTime,
        requiredGuards,
        // Staffing may have just become (in)sufficient, e.g. requiredGuards
        // raised from 1 to 3 on a filled shift.
        status: staffingStatus(
          shift.status,
          shift.assignments.length,
          requiredGuards,
        ),
      },
      include: { site: { select: { name: true } } },
    });

    const changes: string[] = [];
    if (dto.siteId !== undefined && dto.siteId !== shift.siteId) {
      changes.push(`site "${shift.site.name}" -> "${site.name}"`);
    }
    if (startTime.getTime() !== shift.startTime.getTime()) {
      changes.push(
        `start ${shift.startTime.toISOString()} -> ${startTime.toISOString()}`,
      );
    }
    if (endTime.getTime() !== shift.endTime.getTime()) {
      changes.push(
        `end ${shift.endTime.toISOString()} -> ${endTime.toISOString()}`,
      );
    }
    if (requiredGuards !== shift.requiredGuards) {
      changes.push(
        `required guards ${shift.requiredGuards} -> ${requiredGuards}`,
      );
    }

    await this.auditService.log({
      tenantId: user.tenantId,
      userId: user.sub,
      action: 'SHIFT_UPDATED',
      entityType: 'Shift',
      entityId: shiftId,
      details: changes.length
        ? `Shift updated: ${changes.join('; ')}`
        : 'Shift updated with no effective change',
    });

    await this.webhooksService.triggerEvent(user.tenantId, 'shift.updated', {
      shift: updated,
    });

    // A guard who is already on the shift needs to know it moved. Nothing to
    // say when only the headcount changed.
    const timesMoved =
      startTime.getTime() !== shift.startTime.getTime() ||
      endTime.getTime() !== shift.endTime.getTime() ||
      (dto.siteId !== undefined && dto.siteId !== shift.siteId);

    if (timesMoved) {
      for (const assignment of shift.assignments) {
        await this.notifyGuardOfShiftChange(
          user,
          'updated',
          { id: shiftId, startTime, endTime, site },
          assignment.guard,
        );
      }
    }

    return updated;
  }

  /**
   * Deletes a shift.
   *
   * Refused once the shift has any attendance, patrol or timesheet against it:
   * those cascade in the schema, so deleting would silently destroy a guard's
   * worked record and anything billed from it. Such a shift is corrected by
   * unassigning, not deleted.
   */
  async remove(user: ActiveUser, shiftId: string) {
    const shift = await this.prisma.shift.findFirst({
      where: { id: shiftId, tenantId: user.tenantId, ...branchWhere(user) },
      include: { site: { select: { name: true } } },
    });

    if (!shift) throw new NotFoundException('Shift not found');

    const [attendanceEvents, patrolRuns, timesheets, invoiceItems] =
      await Promise.all([
        this.prisma.attendanceEvent.count({ where: { shiftId } }),
        this.prisma.patrolRun.count({ where: { shiftId } }),
        this.prisma.timesheet.count({ where: { shiftId } }),
        this.prisma.invoiceItem.count({ where: { shiftId } }),
      ]);

    if (attendanceEvents + patrolRuns + timesheets + invoiceItems > 0) {
      throw new BadRequestException(
        'This shift has attendance, patrol or timesheet records against it ' +
          'and cannot be deleted. Unassign the guard instead.',
      );
    }

    // Assignments cascade; nothing worked has happened, so nothing is lost.
    await this.prisma.shift.delete({ where: { id: shiftId } });

    await this.auditService.log({
      tenantId: user.tenantId,
      userId: user.sub,
      action: 'SHIFT_DELETED',
      entityType: 'Shift',
      entityId: shiftId,
      details: `Shift at "${shift.site.name}" on ${shift.startTime.toISOString()} deleted`,
    });

    await this.webhooksService.triggerEvent(user.tenantId, 'shift.deleted', {
      shift_id: shiftId,
    });

    return { id: shiftId, deleted: true };
  }
}
