import { Injectable, NotFoundException, ForbiddenException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateShiftDto } from './dto/create-shift.dto';
import { AuditService } from '../audit/audit.service';
import { AiService } from '../ai/ai.service';

type AttendanceStatus = 'not_started' | 'checked_in' | 'completed';

type AttendanceEventSummary = {
  type: string;
  timestamp: Date;
};

type GuardRecommendation = {
  guard_id: string;
  guard_name: string;
  score: number;
  reasons: string[];
  warnings: string[];
  explanation: string;
  metrics: {
    attendance_rate: number | null;
    site_shifts: number;
    late_check_ins: number;
    missed_shifts: number;
    incidents: number;
    upcoming_workload: number;
  };
};

const LATE_CHECK_IN_MINUTES = 5;
const HISTORY_DAYS = 90;
const WORKLOAD_DAYS = 7;
const HIGH_WORKLOAD_THRESHOLD = 5;
const MEDIUM_WORKLOAD_THRESHOLD = 3;

@Injectable()
export class ShiftsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private aiService: AiService,
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

  private datesOverlap(
    firstStart: Date,
    firstEnd: Date,
    secondStart: Date,
    secondEnd: Date,
  ) {
    return firstStart < secondEnd && firstEnd > secondStart;
  }

  private isUnavailableForShift(
    availability: { status: string; startDate?: Date | null; endDate?: Date | null } | null,
    shift: { startTime: Date; endTime: Date },
  ) {
    if (!availability || availability.status !== 'unavailable') {
      return false;
    }

    if (!availability.startDate && !availability.endDate) {
      return true;
    }

    const unavailableStart = availability.startDate ?? new Date(0);
    const unavailableEnd = availability.endDate ?? new Date('9999-12-31T23:59:59.999Z');

    return this.datesOverlap(
      unavailableStart,
      unavailableEnd,
      shift.startTime,
      shift.endTime,
    );
  }

  private isLateCheckIn(checkInTime: Date, shiftStartTime: Date) {
    return (
      checkInTime.getTime() - shiftStartTime.getTime() >
      LATE_CHECK_IN_MINUTES * 60 * 1000
    );
  }

  private roundScore(value: number) {
    return Math.max(0, Math.min(100, Math.round(value)));
  }

  private roundPercent(value: number) {
    return Math.round(value * 10) / 10;
  }

  private fallbackRecommendationExplanation(input: {
    guardName: string;
    reasons: string[];
    warnings: string[];
  }) {
    const reasonText = input.reasons
      .map((reason) => reason.replace(/\s*\([+-]\d+\)\.?$/g, '').replace(/\.$/, ''))
      .slice(0, 3)
      .join(', ');
    const warningText = input.warnings.length
      ? ` Watch for ${input.warnings[0].toLowerCase().replace(/\.$/, '')}.`
      : '';

    return `${input.guardName} is recommended because ${reasonText || 'their profile fits this shift'}.${warningText}`;
  }

  private async explainRecommendation(input: {
    recommendation: Omit<GuardRecommendation, 'explanation'>;
    siteName: string;
  }) {
    const fallback = this.fallbackRecommendationExplanation({
      guardName: input.recommendation.guard_name,
      reasons: input.recommendation.reasons,
      warnings: input.recommendation.warnings,
    });

    const aiExplanation = await this.aiService.explainGuardRecommendation(
      JSON.stringify({
        guard_name: input.recommendation.guard_name,
        site_name: input.siteName,
        score: input.recommendation.score,
        reasons: input.recommendation.reasons,
        warnings: input.recommendation.warnings,
        metrics: input.recommendation.metrics,
      }),
    );

    return aiExplanation || fallback;
  }

  private async buildGuardRecommendations(
    tenantId: string,
    shiftId: string,
    includeAiExplanation: boolean,
  ): Promise<GuardRecommendation[]> {
    const shift = await this.prisma.shift.findFirst({
      where: { id: shiftId, tenantId },
      include: {
        site: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!shift) {
      throw new NotFoundException('Shift not found');
    }

    const historyStart = new Date(shift.startTime);
    historyStart.setUTCDate(historyStart.getUTCDate() - HISTORY_DAYS);
    const workloadEnd = new Date(shift.startTime);
    workloadEnd.setUTCDate(workloadEnd.getUTCDate() + WORKLOAD_DAYS);

    const [guards, relatedShifts] = await Promise.all([
      this.prisma.guard.findMany({
        where: { tenantId },
        include: {
          availability: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.shift.findMany({
        where: {
          tenantId,
          OR: [
            {
              endTime: {
                gte: historyStart,
                lt: shift.startTime,
              },
            },
            {
              startTime: { lt: shift.endTime },
              endTime: { gt: shift.startTime },
            },
            {
              startTime: {
                gte: shift.startTime,
                lt: workloadEnd,
              },
            },
          ],
        },
        include: {
          assignments: {
            select: {
              guardId: true,
            },
          },
          attendanceEvents: {
            select: {
              guardId: true,
              type: true,
              timestamp: true,
            },
          },
          incidents: {
            select: {
              guardId: true,
            },
          },
        },
      }),
    ]);

    const recommendations = guards
      .map((guard) => {
        if (this.isUnavailableForShift(guard.availability, shift)) {
          return null;
        }

        let score = 0;
        const reasons: string[] = ['Available for this shift (+30).'];
        const warnings: string[] = [];
        score += 30;

        const assignedShifts = relatedShifts.filter((relatedShift) =>
          relatedShift.assignments.some(
            (assignment) => assignment.guardId === guard.id,
          ),
        );
        const pastAssignedShifts = assignedShifts.filter(
          (relatedShift) =>
            relatedShift.id !== shift.id &&
            relatedShift.endTime < shift.startTime &&
            relatedShift.status !== 'cancelled',
        );
        const siteShifts = pastAssignedShifts.filter(
          (relatedShift) => relatedShift.siteId === shift.siteId,
        );

        if (siteShifts.length > 0) {
          score += 20;
          reasons.push(
            `Previously worked ${siteShifts.length} shifts at this site (+20).`,
          );
        } else {
          warnings.push('No prior experience at this site.');
        }

        const attendedPastShifts = pastAssignedShifts.filter((relatedShift) =>
          relatedShift.attendanceEvents.some(
            (event) => event.guardId === guard.id && event.type === 'CHECK_IN',
          ),
        );
        const missedShifts = Math.max(
          0,
          pastAssignedShifts.length - attendedPastShifts.length,
        );
        const attendanceRate =
          pastAssignedShifts.length > 0
            ? this.roundPercent(
                (attendedPastShifts.length / pastAssignedShifts.length) * 100,
              )
            : null;

        if (attendanceRate === null) {
          score += 5;
          reasons.push('Limited attendance history; no negative pattern found (+5).');
        } else if (attendanceRate >= 95) {
          score += 20;
          reasons.push(`Strong attendance history at ${attendanceRate}% (+20).`);
        } else if (attendanceRate >= 85) {
          score += 10;
          reasons.push(`Solid attendance history at ${attendanceRate}% (+10).`);
        } else {
          score -= 15;
          warnings.push(`Attendance history is ${attendanceRate}%.`);
        }

        const lateCheckIns = pastAssignedShifts.reduce((count, relatedShift) => {
          const checkIn = relatedShift.attendanceEvents.find(
            (event) => event.guardId === guard.id && event.type === 'CHECK_IN',
          );
          return checkIn && this.isLateCheckIn(checkIn.timestamp, relatedShift.startTime)
            ? count + 1
            : count;
        }, 0);

        if (lateCheckIns === 0) {
          reasons.push('No late check-ins in recent history.');
        } else {
          const latePenalty = Math.min(15, lateCheckIns * 5);
          score -= latePenalty;
          warnings.push(`${lateCheckIns} late check-ins in recent history (-${latePenalty}).`);
        }

        if (missedShifts > 0) {
          const missedPenalty = Math.min(24, missedShifts * 8);
          score -= missedPenalty;
          warnings.push(`${missedShifts} missed shifts in recent history (-${missedPenalty}).`);
        }

        const incidentCount = pastAssignedShifts.reduce(
          (count, relatedShift) =>
            count +
            relatedShift.incidents.filter(
              (incident) => incident.guardId === guard.id,
            ).length,
          0,
        );

        if (incidentCount === 0) {
          score += 10;
          reasons.push('Low incident involvement (+10).');
        } else if (incidentCount <= 1) {
          score += 5;
          reasons.push('Minimal incident involvement (+5).');
        } else {
          const incidentPenalty = Math.min(15, incidentCount * 5);
          score -= incidentPenalty;
          warnings.push(`${incidentCount} recent incident involvements (-${incidentPenalty}).`);
        }

        const overlappingAssignments = assignedShifts.filter(
          (relatedShift) =>
            relatedShift.id !== shift.id &&
            relatedShift.status !== 'cancelled' &&
            this.datesOverlap(
              relatedShift.startTime,
              relatedShift.endTime,
              shift.startTime,
              shift.endTime,
            ),
        );
        const upcomingWorkload = assignedShifts.filter(
          (relatedShift) =>
            relatedShift.id !== shift.id &&
            relatedShift.status !== 'cancelled' &&
            relatedShift.startTime >= shift.startTime &&
            relatedShift.startTime < workloadEnd,
        ).length;

        if (overlappingAssignments.length > 0) {
          score -= 30;
          warnings.push('Already assigned to an overlapping shift (-30).');
        }

        if (upcomingWorkload >= HIGH_WORKLOAD_THRESHOLD) {
          score -= 20;
          warnings.push(`${upcomingWorkload} upcoming shifts in the next ${WORKLOAD_DAYS} days (-20).`);
        } else if (upcomingWorkload >= MEDIUM_WORKLOAD_THRESHOLD) {
          score -= 10;
          warnings.push(`${upcomingWorkload} upcoming shifts in the next ${WORKLOAD_DAYS} days (-10).`);
        } else {
          reasons.push(`Current workload is ${upcomingWorkload} upcoming shifts.`);
        }

        const recommendation: Omit<GuardRecommendation, 'explanation'> = {
          guard_id: guard.id,
          guard_name: guard.name,
          score: this.roundScore(score),
          reasons,
          warnings,
          metrics: {
            attendance_rate: attendanceRate,
            site_shifts: siteShifts.length,
            late_check_ins: lateCheckIns,
            missed_shifts: missedShifts,
            incidents: incidentCount,
            upcoming_workload: upcomingWorkload,
          },
        };

        return recommendation;
      })
      .filter(
        (recommendation): recommendation is Omit<GuardRecommendation, 'explanation'> =>
          Boolean(recommendation),
      )
      .sort((left, right) => right.score - left.score || left.guard_name.localeCompare(right.guard_name));

    const explainedRecommendations = await Promise.all(
      recommendations.map(async (recommendation, index) => ({
        ...recommendation,
        explanation:
          includeAiExplanation && index < 5
            ? await this.explainRecommendation({
                recommendation,
                siteName: shift.site.name,
              })
            : this.fallbackRecommendationExplanation({
                guardName: recommendation.guard_name,
                reasons: recommendation.reasons,
                warnings: recommendation.warnings,
              }),
      })),
    );

    return explainedRecommendations;
  }

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
    try {
      const shifts = await this.prisma.shift.findMany({
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

      return shifts.map((shift) => {
        const attendance = this.summarizeAttendance(shift.attendanceEvents);
        const { attendanceEvents, ...shiftWithoutEvents } = shift;

        return {
          ...shiftWithoutEvents,
          attendanceStatus: attendance.attendanceStatus,
          checkInTime: attendance.checkInTime,
          checkOutTime: attendance.checkOutTime,
        };
      });
    } catch (error) {
      console.error('Shifts findAll error:', error.message);
      throw new InternalServerErrorException(
        'Failed to fetch shifts. The database may be unavailable.',
      );
    }
  }

  async recommendGuards(userId: string, tenantId: string, shiftId: string) {
    const recommendations = await this.buildGuardRecommendations(
      tenantId,
      shiftId,
      true,
    );

    await this.auditService.log({
      tenantId,
      userId,
      action: 'GUARD_RECOMMENDATIONS_GENERATED',
      entityType: 'Shift',
      entityId: shiftId,
      details: `${recommendations.length} guard recommendations generated`,
    });

    return recommendations;
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

    let selectedRecommendation: GuardRecommendation | null = null;
    try {
      const recommendations = await this.buildGuardRecommendations(
        tenantId,
        shiftId,
        false,
      );
      selectedRecommendation =
        recommendations.find((recommendation) => recommendation.guard_id === guardId) ??
        null;
    } catch (error) {
      console.warn(
        'Failed to evaluate guard recommendation during assignment:',
        error instanceof Error ? error.message : error,
      );
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

    if (selectedRecommendation) {
      await this.auditService.log({
        tenantId,
        userId,
        action: 'RECOMMENDED_GUARD_ASSIGNED',
        entityType: 'Shift',
        entityId: shiftId,
        details: `Recommended guard "${guard.name}" assigned with score ${selectedRecommendation.score}`,
      });
    }

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
