import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { AiGovernanceService } from '../ai-governance/ai-governance.service';
import { AiService } from '../ai/ai.service';
import { AiMonitoringService } from '../ai-monitoring/ai-monitoring.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  AiRecommendation,
  GuardRecommendation,
  SchedulingCoverageGap,
  SchedulingOverview,
} from './ai-insights.types';

const LATE_CHECK_IN_MINUTES = 5;
const HISTORY_DAYS = 90;
const WORKLOAD_DAYS = 7;
const SCHEDULING_HORIZON_DAYS = 7;
const HIGH_WORKLOAD_THRESHOLD = 5;
const MEDIUM_WORKLOAD_THRESHOLD = 3;
const DEFAULT_PROMPT_VERSION = 'v5-phase-7';

@Injectable()
export class RecommendationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
    @Optional()
    private readonly aiMonitoringService?: AiMonitoringService,
    @Optional()
    private readonly aiGovernanceService?: AiGovernanceService,
  ) {}

  async recommendGuards(
    tenantId: string,
    shiftId: string,
    includeAiExplanation = true,
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
      .sort(
        (left, right) =>
          right.score - left.score ||
          left.guard_name.localeCompare(right.guard_name),
      );

    const results = await Promise.all(
      recommendations.map(async (recommendation, index) => ({
        ...recommendation,
        explanation:
          includeAiExplanation && index < 5
            ? await this.explainRecommendation({
                tenantId,
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

    if (includeAiExplanation) {
      await this.aiMonitoringService?.logGeneration({
        tenantId,
        promptVersion: DEFAULT_PROMPT_VERSION,
        promptKey: 'guard_recommendation_explanation',
        modelUsed: this.aiService.getModelName(),
        sourceModule: 'ai_scheduling.guard_recommendations',
        generatedOutput: {
          shiftId,
          recommendations: results,
        },
        fallbackUsed: results.some((recommendation) =>
          recommendation.explanation.includes('is recommended because'),
        ),
        status: 'success',
      });
    }

    return results;
  }

  async getSchedulingOverview(tenantId: string): Promise<SchedulingOverview> {
    const now = new Date();
    const horizonEnd = new Date(now);
    horizonEnd.setUTCDate(horizonEnd.getUTCDate() + SCHEDULING_HORIZON_DAYS);

    const upcomingShifts = await this.prisma.shift.findMany({
      where: {
        tenantId,
        startTime: {
          gte: now,
          lt: horizonEnd,
        },
        status: { not: 'cancelled' },
      },
      select: {
        id: true,
        siteId: true,
        startTime: true,
        endTime: true,
        requiredGuards: true,
        status: true,
        site: {
          select: {
            name: true,
          },
        },
        assignments: {
          select: {
            id: true,
          },
        },
      },
      orderBy: { startTime: 'asc' },
    });

    const gaps = upcomingShifts
      .map<SchedulingCoverageGap | null>((shift) => {
        const assignedGuards = shift.assignments.length;
        const shortageSlots = Math.max(0, shift.requiredGuards - assignedGuards);

        if (shortageSlots === 0) return null;

        return {
          shiftId: shift.id,
          siteId: shift.siteId,
          siteName: shift.site.name,
          startTime: shift.startTime.toISOString(),
          endTime: shift.endTime.toISOString(),
          requiredGuards: shift.requiredGuards,
          assignedGuards,
          shortageSlots,
          status: shift.status,
        };
      })
      .filter((gap): gap is SchedulingCoverageGap => Boolean(gap));

    const shortageSlots = gaps.reduce(
      (sum, gap) => sum + gap.shortageSlots,
      0,
    );

    const recommendations = await this.applyFeedback(
      tenantId,
      this.buildSchedulingOverviewRecommendations(
        now,
        gaps,
        shortageSlots,
      ),
    );

    const overview: SchedulingOverview = {
      generatedAt: now.toISOString(),
      horizonDays: SCHEDULING_HORIZON_DAYS,
      totalUpcomingShifts: upcomingShifts.length,
      fullyCoveredShifts: upcomingShifts.length - gaps.length,
      coverageGaps: gaps.length,
      shortageSlots,
      unassignedShifts: gaps.filter((gap) => gap.assignedGuards === 0).length,
      gaps: gaps.slice(0, 10),
      recommendations,
    };

    const generation = await this.aiMonitoringService?.logGeneration({
      tenantId,
      promptVersion: DEFAULT_PROMPT_VERSION,
      modelUsed: this.aiService.getModelName(),
      sourceModule: 'ai_scheduling.overview',
      generatedOutput: overview,
      fallbackUsed: true,
      status: 'fallback',
    });

    return {
      ...overview,
      recommendations:
        this.aiMonitoringService?.attachGenerationId(
          overview.recommendations,
          generation?.id,
        ) ?? overview.recommendations,
    };
  }

  private async applyFeedback(
    tenantId: string,
    recommendations: AiRecommendation[],
  ) {
    if (!this.aiMonitoringService) return recommendations;
    return this.aiMonitoringService.applyFeedbackToRecommendations(
      tenantId,
      recommendations,
    );
  }

  private buildSchedulingOverviewRecommendations(
    now: Date,
    gaps: SchedulingCoverageGap[],
    shortageSlots: number,
  ): AiRecommendation[] {
    const recommendations: AiRecommendation[] = [];
    const oneDayFromNow = new Date(now);
    oneDayFromNow.setUTCDate(oneDayFromNow.getUTCDate() + 1);
    const urgentGap = gaps.find(
      (gap) => new Date(gap.startTime) <= oneDayFromNow,
    );
    const largestGap = [...gaps].sort(
      (left, right) =>
        right.shortageSlots - left.shortageSlots ||
        new Date(left.startTime).getTime() - new Date(right.startTime).getTime(),
    )[0];

    if (urgentGap) {
      recommendations.push({
        id: 'scheduling-urgent-coverage',
        category: 'operations',
        priority: 'high',
        title: 'Close urgent coverage gap',
        action: `Assign ${urgentGap.shortageSlots} guard${urgentGap.shortageSlots === 1 ? '' : 's'} for ${urgentGap.siteName}.`,
        reason: 'A shift inside the next 24 hours is still below required guard coverage.',
        source: 'rule',
        actionType: 'suggest_guard_reassignment',
        targetModule: 'shift',
        targetEntityId: urgentGap.shiftId,
      });
    }

    if (largestGap && largestGap !== urgentGap) {
      recommendations.push({
        id: 'scheduling-largest-gap',
        category: 'operations',
        priority: largestGap.shortageSlots >= 2 ? 'high' : 'medium',
        title: 'Prioritize largest staffing gap',
        action: `Review recommended guards for ${largestGap.siteName}.`,
        reason: `${largestGap.siteName} needs ${largestGap.shortageSlots} more guard slot${largestGap.shortageSlots === 1 ? '' : 's'} filled.`,
        source: 'rule',
        actionType: 'suggest_guard_reassignment',
        targetModule: 'shift',
        targetEntityId: largestGap.shiftId,
      });
    }

    if (gaps.length > 1) {
      recommendations.push({
        id: 'scheduling-weekly-gap-review',
        category: 'operations',
        priority: shortageSlots >= 4 ? 'high' : 'medium',
        title: 'Review weekly guard coverage',
        action: `Resolve ${shortageSlots} open guard slot${shortageSlots === 1 ? '' : 's'} across upcoming shifts.`,
        reason: `${gaps.length} shifts in the next ${SCHEDULING_HORIZON_DAYS} days are below required coverage.`,
        source: 'rule',
        actionType: 'create_follow_up_task',
        targetModule: 'operations',
      });
    }

    if (recommendations.length === 0) {
      recommendations.push({
        id: 'scheduling-maintain-coverage',
        category: 'operations',
        priority: 'low',
        title: 'Maintain scheduling review',
        action: 'Keep reviewing upcoming shifts and recommended guards daily.',
        reason: `No coverage gaps were detected in the next ${SCHEDULING_HORIZON_DAYS} days.`,
        source: 'rule',
        actionType: 'create_follow_up_task',
        targetModule: 'operations',
      });
    }

    return recommendations.slice(0, 5);
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
    availability:
      | { status: string; startDate?: Date | null; endDate?: Date | null }
      | null,
    shift: { startTime: Date; endTime: Date },
  ) {
    if (!availability || availability.status !== 'unavailable') {
      return false;
    }

    if (!availability.startDate && !availability.endDate) {
      return true;
    }

    const unavailableStart = availability.startDate ?? new Date(0);
    const unavailableEnd =
      availability.endDate ?? new Date('9999-12-31T23:59:59.999Z');

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

    return `${input.guardName} is recommended because ${
      reasonText || 'their profile fits this shift'
    }.${warningText}`;
  }

  private async explainRecommendation(input: {
    tenantId: string;
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
      await this.resolvePromptTemplate(
        input.tenantId,
        'ai_scheduling.guard_recommendations',
        'guard_recommendation_explanation',
      ),
    );

    return aiExplanation || fallback;
  }

  private async resolvePromptTemplate(
    tenantId: string,
    moduleName: string,
    promptKey: string,
  ) {
    return (
      await this.aiGovernanceService?.resolvePromptVersion({
        tenantId,
        moduleName,
        promptKey,
        fallbackVersion: DEFAULT_PROMPT_VERSION,
      })
    )?.promptText ?? null;
  }
}
