import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { IncidentsService } from '../incidents/incidents.service';
import { PatrolsService } from '../patrols/patrols.service';
import { SyncOfflineActionsDto } from './dto/sync-offline-actions.dto';
import { attendanceStatusAfterCheckOut } from '../shifts/shift-staffing';
import {
  checkInWindow,
  checkInWindowMessage,
  isLateCheckOut,
  isWithinCheckInWindow,
  LATE_CHECK_OUT_NOTE,
} from './attendance.constants';

// How many times a transiently-failing offline action is tried before it is
// given up on and reported back to the guard as rejected.
const MAX_SYNC_ATTEMPTS = 5;

// A row still 'pending' after this long was left behind by a request that
// died mid-way, and may be claimed again.
const STALE_PENDING_MS = 10 * 60 * 1000;

// How far back the guard's shift list reaches before they ask for more.
const GUARD_SHIFT_HISTORY_DAYS = 7;

function isClientError(error: unknown) {
  if (!(error instanceof HttpException)) return false;
  const status = error.getStatus();
  // 408 / 429 are worth retrying.
  return status >= 400 && status < 500 && status !== 408 && status !== 429;
}

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
    private incidentsService: IncidentsService,
    private patrolsService: PatrolsService,
  ) {}

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
      action:
        data.action === 'CHECK_IN'
          ? 'GUARD_CHECK_IN_INVALID'
          : 'GUARD_CHECK_OUT_INVALID',
      entityType: 'Shift',
      entityId: data.shiftId,
      details: data.reason,
    });
  }

  private isDuplicateAttendanceEvent(error: unknown) {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
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

  /**
   * The guard's shifts, newest first.
   *
   * Bounded by default to the last week plus everything ahead: this returned
   * every assignment the guard had ever had, oldest first, so after a few
   * months today's shift sat somewhere in the middle of a wall of completed
   * ones. `includeHistory` restores the full list behind a "show older"
   * action, which is the only place the long list is actually wanted.
   */
  async getAssignedShifts(
    tenantId: string,
    guardId: string,
    includeHistory = false,
  ) {
    await this.getProfile(tenantId, guardId);

    const recentSince = new Date(
      Date.now() - GUARD_SHIFT_HISTORY_DAYS * 24 * 60 * 60 * 1000,
    );

    const assignments = await this.prisma.assignment.findMany({
      where: {
        guardId,
        shift: {
          tenantId,
          ...(includeHistory ? {} : { endTime: { gte: recentSince } }),
        },
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
      .sort(
        (left, right) =>
          right.shift.startTime.getTime() - left.shift.startTime.getTime(),
      )
      .map((assignment) => {
        const attendance = this.summarizeAttendance(
          assignment.shift.attendanceEvents,
        );

        return {
          id: assignment.shift.id,
          shiftId: assignment.shift.id,
          siteName: assignment.shift.site.name,
          siteAddress: assignment.shift.site.address,
          startTime: assignment.shift.startTime,
          endTime: assignment.shift.endTime,
          status: assignment.shift.status,
          attendanceStatus: attendance.attendanceStatus,
          checkInTime: attendance.checkInTime,
          checkOutTime: attendance.checkOutTime,
        };
      });
  }

  async getShiftDetail(tenantId: string, guardId: string, shiftId: string) {
    const { shift, assignment } = await this.getAssignedShiftContext(
      tenantId,
      guardId,
      shiftId,
    );
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
      attendanceStatus: attendance.attendanceStatus,
      checkInTime: attendance.checkInTime,
      checkOutTime: attendance.checkOutTime,
      // So the app can disable Check In with "Opens at ..." instead of letting
      // the guard tap it and read a rejection.
      ...checkInWindow(shift),
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

  /**
   * Records a guard's arrival.
   *
   * `occurredAt` is when the guard actually pressed the button. It is only
   * passed by the offline replay, where the request can arrive long after the
   * action: validating a queued check-in against the moment it finally syncs
   * would punish a guard who had no signal on site. It is bounded to no later
   * than now, so a device clock running fast cannot open the window early,
   * and the event is stamped with the same moment the window was checked
   * against, so the record and the rule agree.
   */
  async checkIn(
    tenantId: string,
    guardId: string,
    shiftId: string,
    occurredAt?: Date,
  ) {
    const { shift, assignment } = await this.getAssignedShiftContext(
      tenantId,
      guardId,
      shiftId,
      'CHECK_IN',
    );
    const attendance = this.summarizeAttendance(shift.attendanceEvents);

    const now = new Date();
    const at =
      occurredAt && occurredAt.getTime() < now.getTime() ? occurredAt : now;

    if (attendance.checkInTime) {
      await this.logInvalidAttendanceAttempt({
        tenantId,
        guardId,
        shiftId,
        action: 'CHECK_IN',
        reason: 'Guard has already checked in for this shift',
      });
      throw new BadRequestException(
        'Guard has already checked in for this shift',
      );
    }

    if (attendance.checkOutTime) {
      await this.logInvalidAttendanceAttempt({
        tenantId,
        guardId,
        shiftId,
        action: 'CHECK_IN',
        reason: 'Guard has already checked out for this shift',
      });
      throw new BadRequestException(
        'Guard has already checked out for this shift',
      );
    }

    if (!isWithinCheckInWindow(shift, at)) {
      const reason = checkInWindowMessage(shift);
      await this.logInvalidAttendanceAttempt({
        tenantId,
        guardId,
        shiftId,
        action: 'CHECK_IN',
        reason,
      });
      throw new BadRequestException(reason);
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
            timestamp: at,
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
        throw new BadRequestException(
          'Guard has already checked in for this shift',
        );
      }

      throw error;
    }
  }

  async checkOut(tenantId: string, guardId: string, shiftId: string) {
    const { shift, assignment } = await this.getAssignedShiftContext(
      tenantId,
      guardId,
      shiftId,
      'CHECK_OUT',
    );
    const attendance = this.summarizeAttendance(shift.attendanceEvents);

    if (attendance.checkOutTime) {
      await this.logInvalidAttendanceAttempt({
        tenantId,
        guardId,
        shiftId,
        action: 'CHECK_OUT',
        reason: 'Guard has already checked out for this shift',
      });
      throw new BadRequestException(
        'Guard has already checked out for this shift',
      );
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

    // Guard against clock skew / tampering: the check-out moment (now) must be
    // after the recorded check-in. Without this, a backwards timestamp silently
    // produces a 0-hour timesheet on a billable record.
    if (Date.now() <= checkInTime.getTime()) {
      await this.logInvalidAttendanceAttempt({
        tenantId,
        guardId,
        shiftId,
        action: 'CHECK_OUT',
        reason: 'Check-out time is not after the recorded check-in time',
      });
      throw new BadRequestException(
        'Check-out time must be after the recorded check-in time. Please try again.',
      );
    }

    // Check-out is never refused for being late -- that would leave the shift
    // open and produce no timesheet - but a late one is flagged on the event
    // so whoever reviews the timesheet sees it.
    const lateNote = isLateCheckOut(shift, new Date())
      ? LATE_CHECK_OUT_NOTE
      : null;

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const attendanceEvent = await tx.attendanceEvent.create({
          data: {
            tenantId,
            guardId,
            shiftId,
            type: 'CHECK_OUT',
            source: 'guard_portal',
            ...(lateNote ? { notes: lateNote } : {}),
          },
        });

        // With several guards on one shift, this guard leaving does not end
        // the shift while a colleague is still on duty. See shift-staffing.ts.
        const [checkInCount, checkOutCount] = await Promise.all([
          tx.attendanceEvent.count({ where: { shiftId, type: 'CHECK_IN' } }),
          tx.attendanceEvent.count({ where: { shiftId, type: 'CHECK_OUT' } }),
        ]);
        const shiftStatus = attendanceStatusAfterCheckOut(
          checkInCount,
          checkOutCount,
        );

        await tx.shift.update({
          where: { id: shiftId },
          data: { status: shiftStatus },
        });

        const totalHours = this.roundHours(
          Math.max(
            0,
            (attendanceEvent.timestamp.getTime() - checkInTime.getTime()) /
              3_600_000,
          ),
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

        return { attendanceEvent, timesheet, shiftStatus };
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
        shiftStatus: result.shiftStatus,
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
        throw new BadRequestException(
          'Guard has already checked out for this shift',
        );
      }

      throw error;
    }
  }

  async getSyncStatus(tenantId: string, guardId: string) {
    return this.prisma.guardSyncQueue.findMany({
      where: { tenantId, guardId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  /**
   * Records an incoming offline action and decides whether this request should
   * apply it. Returns the row with status 'pending' when it should; any other
   * status means leave it alone.
   *
   * A 'failed' row (or a 'pending' one abandoned by a crashed request) is
   * re-claimed for a retry with a conditional update, so two overlapping sync
   * requests (the browser's online event and the guard pressing Retry) can't
   * both apply the same action.
   */
  private async claimSyncAction(
    tenantId: string,
    guardId: string,
    action: SyncOfflineActionsDto['actions'][number],
  ) {
    const existing = await this.prisma.guardSyncQueue.findFirst({
      where: { tenantId, guardId, id: action.id },
    });

    if (!existing) {
      try {
        return await this.prisma.guardSyncQueue.create({
          data: {
            id: action.id,
            tenantId,
            guardId,
            actionType: action.actionType,
            payload: action.payload,
            status: 'pending',
            createdAt: new Date(action.createdAt),
          },
        });
      } catch (error) {
        // Lost a race with an overlapping request that created it first.
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          const winner = await this.prisma.guardSyncQueue.findFirst({
            where: { tenantId, guardId, id: action.id },
          });
          if (winner) {
            return winner.status === 'pending'
              ? { ...winner, status: 'in_progress' }
              : winner;
          }
        }
        throw error;
      }
    }

    if (existing.status === 'synced' || existing.status === 'rejected') {
      return existing;
    }

    const staleBefore = new Date(Date.now() - STALE_PENDING_MS);
    const claimed = await this.prisma.guardSyncQueue.updateMany({
      where: {
        id: existing.id,
        OR: [
          { status: 'failed' },
          { status: 'pending', updatedAt: { lt: staleBefore } },
        ],
      },
      data: { status: 'pending' },
    });
    if (claimed.count === 0) {
      // Another request is applying it right now.
      return { ...existing, status: 'in_progress' };
    }
    return { ...existing, status: 'pending' };
  }

  async processSyncQueue(
    tenantId: string,
    guardId: string,
    dto: SyncOfflineActionsDto,
  ) {
    const results: Awaited<
      ReturnType<typeof this.prisma.guardSyncQueue.create>
    >[] = [];

    // Sort actions by original createdAt
    const sortedActions = [...dto.actions].sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );

    for (const action of sortedActions) {
      const record = await this.claimSyncAction(tenantId, guardId, action);
      if (record.status !== 'pending') {
        // Already final (synced / rejected), or another sync request is
        // applying it right now.
        results.push(record);
        continue;
      }

      try {
        if (action.actionType === 'check_in') {
          try {
            // Replayed against the moment the guard pressed the button, not
            // the moment the queue drained; see checkIn.
            await this.checkIn(
              tenantId,
              guardId,
              action.payload.shiftId,
              new Date(action.createdAt),
            );
          } catch (error) {
            if (
              error.message === 'Guard has already checked in for this shift'
            ) {
              // Ignore already checked in
            } else {
              throw error;
            }
          }
        } else if (action.actionType === 'check_out') {
          try {
            await this.checkOut(tenantId, guardId, action.payload.shiftId);
          } catch (error) {
            if (
              error.message === 'Guard has already checked out for this shift'
            ) {
              // Ignore already checked out
            } else {
              throw error;
            }
          }
        } else if (action.actionType === 'incident_create') {
          await this.incidentsService.createForGuard(
            tenantId,
            guardId,
            action.payload.shiftId,
            action.payload.dto,
          );
        } else if (action.actionType === 'patrol_checkpoint_scan') {
          await this.patrolsService.scanCheckpoint(
            tenantId,
            guardId,
            action.payload.runId,
            action.payload.checkpointId,
            action.payload.dto,
          );
        } else if (action.actionType === 'patrol_run_complete') {
          await this.patrolsService.completePatrolRun(
            tenantId,
            guardId,
            action.payload.runId,
          );
        } else {
          throw new BadRequestException(
            `Unknown action type: ${action.actionType}`,
          );
        }

        // Mark as synced
        const synced = await this.prisma.guardSyncQueue.update({
          where: { id: action.id },
          data: { status: 'synced', syncedAt: new Date(), errorMessage: null },
        });
        results.push(synced);
      } catch (error) {
        // A 4xx means the action itself is unacceptable (shift not found,
        // guard deactivated...) and will never succeed, so don't retry it.
        // Anything else is retried on the next sync, up to a cap.
        const retryCount = record.retryCount + 1;
        const permanent =
          isClientError(error) || retryCount >= MAX_SYNC_ATTEMPTS;
        const failed = await this.prisma.guardSyncQueue.update({
          where: { id: action.id },
          data: {
            status: permanent ? 'rejected' : 'failed',
            retryCount,
            errorMessage:
              error instanceof Error ? error.message : 'Unknown error',
          },
        });
        results.push(failed);
      }
    }

    await this.auditService.log({
      tenantId,
      userId: guardId,
      action: 'GUARD_OFFLINE_SYNC_COMPLETED',
      entityType: 'GuardSyncQueue',
      details: `Processed ${dto.actions.length} offline actions for guard`,
    });

    return results;
  }
}
