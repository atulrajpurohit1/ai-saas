import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAiFeedbackDto } from './dto/create-ai-feedback.dto';
import {
  AiGenerationStatus,
  AiMonitoringMetrics,
  FeedbackAwareRecommendation,
  FeedbackPromptSummary,
  LogAiGenerationInput,
} from './ai-monitoring.types';

const DEFAULT_PROMPT_VERSION = 'v5-phase-7';
const DEFAULT_MODEL_USED = 'rule-or-fallback';
const REJECTED_ACTION_THRESHOLD = 2;

@Injectable()
export class AiMonitoringService {
  private readonly logger = new Logger(AiMonitoringService.name);

  constructor(private readonly prisma: PrismaService) {}

  async logGeneration(input: LogAiGenerationInput) {
    try {
      return await this.prisma.aiGeneration.create({
        data: {
          tenantId: input.tenantId,
          promptVersion: input.promptVersion || DEFAULT_PROMPT_VERSION,
          modelUsed: input.modelUsed || DEFAULT_MODEL_USED,
          sourceModule: input.sourceModule,
          generatedOutput: this.toJsonValue(input.generatedOutput),
          fallbackUsed: input.fallbackUsed,
          status: input.status,
          errorMessage: input.errorMessage,
          createdBy: input.createdBy,
        },
      });
    } catch (error) {
      this.logger.warn(
        `AI generation logging skipped: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }

  async createFeedback(
    tenantId: string,
    createdBy: string,
    dto: CreateAiFeedbackDto,
  ) {
    const action = dto.actionId
      ? await this.prisma.recommendationAction.findFirst({
          where: { id: dto.actionId, tenantId },
        })
      : null;

    if (dto.actionId && !action) {
      throw new NotFoundException('AI action not found for this tenant');
    }

    const aiGenerationId = await this.resolveFeedbackGenerationId(
      tenantId,
      createdBy,
      dto,
      action?.aiGenerationId ?? null,
    );

    return this.prisma.aiFeedback.create({
      data: {
        tenantId,
        aiGenerationId,
        recommendationId: dto.recommendationId ?? action?.recommendationId ?? null,
        actionId: action?.id ?? null,
        rating: dto.rating,
        feedbackText: dto.feedbackText?.trim() || null,
        isUseful: dto.isUseful,
        isAccurate: dto.isAccurate,
        createdBy,
      },
      include: {
        aiGeneration: {
          select: {
            id: true,
            sourceModule: true,
            status: true,
            fallbackUsed: true,
          },
        },
      },
    });
  }

  async findFeedback(tenantId: string) {
    return this.prisma.aiFeedback.findMany({
      where: { tenantId },
      include: {
        aiGeneration: {
          select: {
            id: true,
            sourceModule: true,
            modelUsed: true,
            promptVersion: true,
            status: true,
            fallbackUsed: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async getMonitoring(tenantId: string): Promise<AiMonitoringMetrics> {
    const [
      generations,
      actions,
      feedback,
      averageFeedback,
      recentFeedback,
    ] = await Promise.all([
      this.prisma.aiGeneration.findMany({
        where: { tenantId },
        select: {
          status: true,
          fallbackUsed: true,
          sourceModule: true,
        },
      }),
      this.prisma.recommendationAction.findMany({
        where: { tenantId },
        select: { status: true },
      }),
      this.prisma.aiFeedback.findMany({
        where: { tenantId },
        select: {
          isUseful: true,
          isAccurate: true,
        },
      }),
      this.prisma.aiFeedback.aggregate({
        where: { tenantId },
        _avg: { rating: true },
      }),
      this.prisma.aiFeedback.findMany({
        where: { tenantId },
        include: {
          aiGeneration: {
            select: {
              sourceModule: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

    const totalAiGenerations = generations.length;
    const totalFeedback = feedback.length;
    const fallbackUsageCount = generations.filter(
      (generation) =>
        generation.fallbackUsed || generation.status === 'fallback',
    ).length;
    const aiSuccessCount = generations.filter(
      (generation) => generation.status === 'success',
    ).length;
    const aiFailureCount = generations.filter(
      (generation) => generation.status === 'failed',
    ).length;
    const acceptedRecommendations = actions.filter((action) =>
      ['approved', 'executed'].includes(action.status),
    ).length;
    const rejectedRecommendations = actions.filter(
      (action) => action.status === 'rejected',
    ).length;
    const executedAiActions = actions.filter(
      (action) => action.status === 'executed',
    ).length;
    const failedAiActions = actions.filter(
      (action) => action.status === 'failed',
    ).length;
    const usefulCount = feedback.filter((item) => item.isUseful).length;
    const accurateCount = feedback.filter((item) => item.isAccurate).length;
    const approvalDecisions = acceptedRecommendations + rejectedRecommendations;
    const executionDecisions = executedAiActions + failedAiActions;

    return {
      generatedAt: new Date().toISOString(),
      totals: {
        totalAiGenerations,
        totalFeedback,
        acceptedRecommendations,
        rejectedRecommendations,
        executedAiActions,
        failedAiActions,
        averageFeedbackRating: this.roundNullable(
          averageFeedback._avg.rating ?? null,
          2,
        ),
        aiSuccessCount,
        aiFailureCount,
        fallbackUsageCount,
      },
      quality: {
        accuracyRate: this.rate(accurateCount, totalFeedback),
        usefulnessRate: this.rate(usefulCount, totalFeedback),
        actionApprovalRate: this.rate(
          acceptedRecommendations,
          approvalDecisions,
        ),
        actionExecutionSuccessRate: this.rate(
          executedAiActions,
          executionDecisions,
        ),
        fallbackDependencyRate: this.rate(
          fallbackUsageCount,
          totalAiGenerations,
        ),
      },
      statusBreakdown: this.buildGenerationStatusBreakdown(generations),
      actionStatusBreakdown: this.buildActionStatusBreakdown(actions),
      sourceModuleBreakdown: this.buildSourceModuleBreakdown(generations),
      recentFeedback: recentFeedback.map((item) => ({
        id: item.id,
        rating: item.rating,
        feedbackText: item.feedbackText,
        isUseful: item.isUseful,
        isAccurate: item.isAccurate,
        recommendationId: item.recommendationId,
        actionId: item.actionId,
        sourceModule: item.aiGeneration.sourceModule,
        createdAt: item.createdAt.toISOString(),
      })),
    };
  }

  async getFeedbackSummaryForPrompt(
    tenantId: string,
  ): Promise<FeedbackPromptSummary> {
    const [feedback, rejectedActions] = await Promise.all([
      this.prisma.aiFeedback.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.prisma.recommendationAction.groupBy({
        by: ['actionType'],
        where: {
          tenantId,
          status: 'rejected',
        },
        _count: {
          actionType: true,
        },
      }),
    ]);

    const totalFeedback = feedback.length;
    const usefulCount = feedback.filter((item) => item.isUseful).length;
    const accurateCount = feedback.filter((item) => item.isAccurate).length;
    const averageRating =
      totalFeedback === 0
        ? null
        : this.round(
            feedback.reduce((sum, item) => sum + item.rating, 0) /
              totalFeedback,
            2,
          );
    const usefulComments = feedback
      .filter((item) => item.isUseful && item.feedbackText)
      .map((item) => item.feedbackText)
      .slice(0, 3);

    const rejectedActionTypes = rejectedActions
      .filter((item) => item._count.actionType >= REJECTED_ACTION_THRESHOLD)
      .map((item) => item.actionType);

    return {
      averageRating,
      totalFeedback,
      usefulCount,
      accurateCount,
      rejectedActionTypes,
      summaryText:
        totalFeedback === 0
          ? null
          : [
              `Recent admin feedback average rating is ${averageRating}/5.`,
              `${this.rate(usefulCount, totalFeedback)}% marked useful.`,
              `${this.rate(accurateCount, totalFeedback)}% marked accurate.`,
              rejectedActionTypes.length
                ? `Repeatedly rejected action types: ${rejectedActionTypes.join(', ')}.`
                : null,
              usefulComments.length
                ? `Useful feedback notes: ${usefulComments.join(' | ')}`
                : null,
            ]
              .filter(Boolean)
              .join(' '),
    };
  }

  async applyFeedbackToRecommendations(
    tenantId: string,
    recommendations: FeedbackAwareRecommendation[],
  ): Promise<FeedbackAwareRecommendation[]> {
    if (recommendations.length === 0) return recommendations;

    const summary = await this.getFeedbackSummaryForPrompt(tenantId);
    const rejectedActionTypes = new Set(summary.rejectedActionTypes);

    return recommendations.map((recommendation) => {
      const isRepeatedlyRejected =
        recommendation.actionType &&
        rejectedActionTypes.has(recommendation.actionType);

      if (!isRepeatedlyRejected) {
        return {
          ...recommendation,
          confidence:
            recommendation.confidence ||
            (recommendation.source === 'ai' ? 'medium' : 'high'),
        };
      }

      return {
        ...recommendation,
        priority: this.downgradePriority(recommendation.priority),
        confidence: 'low',
        reason: recommendation.reason.includes('repeatedly rejected')
          ? recommendation.reason
          : `${recommendation.reason} Low confidence: similar ${recommendation.actionType?.replace(
              /_/g,
              ' ',
            )} suggestions were repeatedly rejected.`,
      };
    });
  }

  attachGenerationId<T extends FeedbackAwareRecommendation>(
    recommendations: T[],
    aiGenerationId?: string | null,
  ): T[] {
    if (!aiGenerationId) return recommendations;

    return recommendations.map((recommendation) => ({
      ...recommendation,
      aiGenerationId,
    }));
  }

  private async resolveFeedbackGenerationId(
    tenantId: string,
    createdBy: string,
    dto: CreateAiFeedbackDto,
    actionGenerationId: string | null,
  ) {
    const requestedGenerationId = dto.aiGenerationId || actionGenerationId;

    if (requestedGenerationId) {
      const generation = await this.prisma.aiGeneration.findFirst({
        where: { id: requestedGenerationId, tenantId },
        select: { id: true },
      });

      if (!generation) {
        throw new NotFoundException('AI generation not found for this tenant');
      }

      return generation.id;
    }

    if (!dto.recommendationId && !dto.actionId) {
      throw new BadRequestException(
        'Feedback must reference an AI generation, recommendation, or action.',
      );
    }

    const generation = await this.prisma.aiGeneration.create({
      data: {
        tenantId,
        promptVersion: DEFAULT_PROMPT_VERSION,
        modelUsed: DEFAULT_MODEL_USED,
        sourceModule: dto.actionId
          ? 'ai_actions.legacy_feedback'
          : 'ai_recommendations.legacy_feedback',
        generatedOutput: this.toJsonValue({
          recommendationId: dto.recommendationId,
          actionId: dto.actionId,
          note: 'Feedback was submitted for an output generated before Phase 7 logging.',
        }),
        fallbackUsed: false,
        status: 'success',
        createdBy,
      },
    });

    return generation.id;
  }

  private toJsonValue(value: unknown): Prisma.InputJsonValue {
    try {
      return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
    } catch {
      return { value: String(value) };
    }
  }

  private downgradePriority(priority: 'high' | 'medium' | 'low') {
    if (priority === 'high') return 'medium';
    if (priority === 'medium') return 'low';
    return 'low';
  }

  private buildGenerationStatusBreakdown(
    generations: Array<{ status: string }>,
  ): Record<AiGenerationStatus, number> {
    return {
      success: generations.filter((item) => item.status === 'success').length,
      failed: generations.filter((item) => item.status === 'failed').length,
      fallback: generations.filter((item) => item.status === 'fallback').length,
    };
  }

  private buildActionStatusBreakdown(actions: Array<{ status: string }>) {
    return actions.reduce<Record<string, number>>((breakdown, action) => {
      breakdown[action.status] = (breakdown[action.status] || 0) + 1;
      return breakdown;
    }, {});
  }

  private buildSourceModuleBreakdown(
    generations: Array<{
      sourceModule: string;
      status: string;
      fallbackUsed: boolean;
    }>,
  ) {
    const bySource = new Map<
      string,
      {
        sourceModule: string;
        total: number;
        success: number;
        failed: number;
        fallback: number;
        fallbackUsed: number;
      }
    >();

    generations.forEach((generation) => {
      const row =
        bySource.get(generation.sourceModule) ||
        {
          sourceModule: generation.sourceModule,
          total: 0,
          success: 0,
          failed: 0,
          fallback: 0,
          fallbackUsed: 0,
        };

      row.total += 1;
      if (generation.status === 'success') row.success += 1;
      if (generation.status === 'failed') row.failed += 1;
      if (generation.status === 'fallback') row.fallback += 1;
      if (generation.fallbackUsed) row.fallbackUsed += 1;
      bySource.set(generation.sourceModule, row);
    });

    return Array.from(bySource.values()).sort((a, b) => b.total - a.total);
  }

  private rate(numerator: number, denominator: number) {
    if (denominator === 0) return 0;
    return this.round((numerator / denominator) * 100, 1);
  }

  private round(value: number, decimals: number) {
    const factor = 10 ** decimals;
    return Math.round(value * factor) / factor;
  }

  private roundNullable(value: number | null, decimals: number) {
    return value === null ? null : this.round(value, decimals);
  }
}
