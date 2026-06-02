"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var AiMonitoringService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiMonitoringService = void 0;
const common_1 = require("@nestjs/common");
const ai_governance_service_1 = require("../ai-governance/ai-governance.service");
const prisma_service_1 = require("../prisma/prisma.service");
const DEFAULT_PROMPT_VERSION = 'v5-phase-7';
const DEFAULT_MODEL_USED = 'rule-or-fallback';
const REJECTED_ACTION_THRESHOLD = 2;
let AiMonitoringService = AiMonitoringService_1 = class AiMonitoringService {
    prisma;
    aiGovernanceService;
    logger = new common_1.Logger(AiMonitoringService_1.name);
    constructor(prisma, aiGovernanceService) {
        this.prisma = prisma;
        this.aiGovernanceService = aiGovernanceService;
    }
    async logGeneration(input) {
        try {
            const prompt = await this.aiGovernanceService.resolvePromptVersion({
                tenantId: input.tenantId,
                moduleName: input.sourceModule,
                promptKey: input.promptKey,
                fallbackVersion: input.promptVersion || DEFAULT_PROMPT_VERSION,
            });
            const safety = this.aiGovernanceService.evaluateSafety({
                generatedOutput: input.generatedOutput,
                inputSource: input.inputSource,
                clientVisible: input.clientVisible,
            });
            return await this.prisma.aiGeneration.create({
                data: {
                    tenantId: input.tenantId,
                    promptVersion: prompt.promptVersion,
                    promptVersionId: prompt.promptVersionId,
                    modelUsed: input.modelUsed || DEFAULT_MODEL_USED,
                    sourceModule: input.sourceModule,
                    inputSource: input.inputSource === undefined
                        ? undefined
                        : this.toJsonValue(input.inputSource),
                    generatedOutput: this.toJsonValue(input.generatedOutput),
                    fallbackUsed: input.fallbackUsed,
                    status: input.status,
                    errorMessage: input.errorMessage,
                    clientVisible: input.clientVisible ?? false,
                    approvalStatus: this.aiGovernanceService.approvalStatusFor({
                        clientVisible: input.clientVisible,
                        safetyStatus: safety.status,
                    }),
                    safetyStatus: safety.status,
                    safetyFindings: this.toJsonValue(safety.findings),
                    createdBy: input.createdBy,
                },
            });
        }
        catch (error) {
            this.logger.warn(`AI generation logging skipped: ${error instanceof Error ? error.message : String(error)}`);
            return null;
        }
    }
    async createFeedback(tenantId, createdBy, dto) {
        const action = dto.actionId
            ? await this.prisma.recommendationAction.findFirst({
                where: { id: dto.actionId, tenantId },
            })
            : null;
        if (dto.actionId && !action) {
            throw new common_1.NotFoundException('AI action not found for this tenant');
        }
        const aiGenerationId = await this.resolveFeedbackGenerationId(tenantId, createdBy, dto, action?.aiGenerationId ?? null);
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
    async findFeedback(tenantId) {
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
    async getMonitoring(tenantId) {
        const [generations, actions, feedback, averageFeedback, recentFeedback,] = await Promise.all([
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
        const fallbackUsageCount = generations.filter((generation) => generation.fallbackUsed || generation.status === 'fallback').length;
        const aiSuccessCount = generations.filter((generation) => generation.status === 'success').length;
        const aiFailureCount = generations.filter((generation) => generation.status === 'failed').length;
        const acceptedRecommendations = actions.filter((action) => ['approved', 'executed'].includes(action.status)).length;
        const rejectedRecommendations = actions.filter((action) => action.status === 'rejected').length;
        const executedAiActions = actions.filter((action) => action.status === 'executed').length;
        const failedAiActions = actions.filter((action) => action.status === 'failed').length;
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
                averageFeedbackRating: this.roundNullable(averageFeedback._avg.rating ?? null, 2),
                aiSuccessCount,
                aiFailureCount,
                fallbackUsageCount,
            },
            quality: {
                accuracyRate: this.rate(accurateCount, totalFeedback),
                usefulnessRate: this.rate(usefulCount, totalFeedback),
                actionApprovalRate: this.rate(acceptedRecommendations, approvalDecisions),
                actionExecutionSuccessRate: this.rate(executedAiActions, executionDecisions),
                fallbackDependencyRate: this.rate(fallbackUsageCount, totalAiGenerations),
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
    async getFeedbackSummaryForPrompt(tenantId) {
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
        const averageRating = totalFeedback === 0
            ? null
            : this.round(feedback.reduce((sum, item) => sum + item.rating, 0) /
                totalFeedback, 2);
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
            summaryText: totalFeedback === 0
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
    async applyFeedbackToRecommendations(tenantId, recommendations) {
        if (recommendations.length === 0)
            return recommendations;
        const summary = await this.getFeedbackSummaryForPrompt(tenantId);
        const rejectedActionTypes = new Set(summary.rejectedActionTypes);
        return recommendations.map((recommendation) => {
            const isRepeatedlyRejected = recommendation.actionType &&
                rejectedActionTypes.has(recommendation.actionType);
            if (!isRepeatedlyRejected) {
                return {
                    ...recommendation,
                    confidence: recommendation.confidence ||
                        (recommendation.source === 'ai' ? 'medium' : 'high'),
                };
            }
            return {
                ...recommendation,
                priority: this.downgradePriority(recommendation.priority),
                confidence: 'low',
                reason: recommendation.reason.includes('repeatedly rejected')
                    ? recommendation.reason
                    : `${recommendation.reason} Low confidence: similar ${recommendation.actionType?.replace(/_/g, ' ')} suggestions were repeatedly rejected.`,
            };
        });
    }
    attachGenerationId(recommendations, aiGenerationId) {
        if (!aiGenerationId)
            return recommendations;
        return recommendations.map((recommendation) => ({
            ...recommendation,
            aiGenerationId,
        }));
    }
    async resolveFeedbackGenerationId(tenantId, createdBy, dto, actionGenerationId) {
        const requestedGenerationId = dto.aiGenerationId || actionGenerationId;
        if (requestedGenerationId) {
            const generation = await this.prisma.aiGeneration.findFirst({
                where: { id: requestedGenerationId, tenantId },
                select: { id: true },
            });
            if (!generation) {
                throw new common_1.NotFoundException('AI generation not found for this tenant');
            }
            return generation.id;
        }
        if (!dto.recommendationId && !dto.actionId) {
            throw new common_1.BadRequestException('Feedback must reference an AI generation, recommendation, or action.');
        }
        const generation = await this.prisma.aiGeneration.create({
            data: {
                tenantId,
                promptVersion: DEFAULT_PROMPT_VERSION,
                modelUsed: DEFAULT_MODEL_USED,
                sourceModule: dto.actionId
                    ? 'ai_actions.legacy_feedback'
                    : 'ai_recommendations.legacy_feedback',
                clientVisible: false,
                approvalStatus: 'not_required',
                safetyStatus: 'passed',
                safetyFindings: [],
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
    toJsonValue(value) {
        try {
            return JSON.parse(JSON.stringify(value ?? null));
        }
        catch {
            return { value: String(value) };
        }
    }
    downgradePriority(priority) {
        if (priority === 'high')
            return 'medium';
        if (priority === 'medium')
            return 'low';
        return 'low';
    }
    buildGenerationStatusBreakdown(generations) {
        return {
            success: generations.filter((item) => item.status === 'success').length,
            failed: generations.filter((item) => item.status === 'failed').length,
            fallback: generations.filter((item) => item.status === 'fallback').length,
        };
    }
    buildActionStatusBreakdown(actions) {
        return actions.reduce((breakdown, action) => {
            breakdown[action.status] = (breakdown[action.status] || 0) + 1;
            return breakdown;
        }, {});
    }
    buildSourceModuleBreakdown(generations) {
        const bySource = new Map();
        generations.forEach((generation) => {
            const row = bySource.get(generation.sourceModule) ||
                {
                    sourceModule: generation.sourceModule,
                    total: 0,
                    success: 0,
                    failed: 0,
                    fallback: 0,
                    fallbackUsed: 0,
                };
            row.total += 1;
            if (generation.status === 'success')
                row.success += 1;
            if (generation.status === 'failed')
                row.failed += 1;
            if (generation.status === 'fallback')
                row.fallback += 1;
            if (generation.fallbackUsed)
                row.fallbackUsed += 1;
            bySource.set(generation.sourceModule, row);
        });
        return Array.from(bySource.values()).sort((a, b) => b.total - a.total);
    }
    rate(numerator, denominator) {
        if (denominator === 0)
            return 0;
        return this.round((numerator / denominator) * 100, 1);
    }
    round(value, decimals) {
        const factor = 10 ** decimals;
        return Math.round(value * factor) / factor;
    }
    roundNullable(value, decimals) {
        return value === null ? null : this.round(value, decimals);
    }
};
exports.AiMonitoringService = AiMonitoringService;
exports.AiMonitoringService = AiMonitoringService = AiMonitoringService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        ai_governance_service_1.AiGovernanceService])
], AiMonitoringService);
//# sourceMappingURL=ai-monitoring.service.js.map