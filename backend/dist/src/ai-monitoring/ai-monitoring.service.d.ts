import { Prisma } from '@prisma/client';
import { AiGovernanceService } from '../ai-governance/ai-governance.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAiFeedbackDto } from './dto/create-ai-feedback.dto';
import { AiMonitoringMetrics, FeedbackAwareRecommendation, FeedbackPromptSummary, LogAiGenerationInput } from './ai-monitoring.types';
export declare class AiMonitoringService {
    private readonly prisma;
    private readonly aiGovernanceService;
    private readonly logger;
    constructor(prisma: PrismaService, aiGovernanceService: AiGovernanceService);
    logGeneration(input: LogAiGenerationInput): Promise<{
        id: string;
        createdAt: Date;
        tenantId: string;
        status: string;
        promptVersion: string;
        createdBy: string | null;
        promptVersionId: string | null;
        modelUsed: string;
        sourceModule: string;
        inputSource: Prisma.JsonValue | null;
        generatedOutput: Prisma.JsonValue;
        fallbackUsed: boolean;
        errorMessage: string | null;
        clientVisible: boolean;
        approvalStatus: string;
        approvedBy: string | null;
        approvedAt: Date | null;
        safetyStatus: string;
        safetyFindings: Prisma.JsonValue | null;
    } | null>;
    createFeedback(tenantId: string, createdBy: string, dto: CreateAiFeedbackDto): Promise<{
        aiGeneration: {
            id: string;
            status: string;
            sourceModule: string;
            fallbackUsed: boolean;
        };
    } & {
        id: string;
        createdAt: Date;
        tenantId: string;
        createdBy: string;
        aiGenerationId: string;
        recommendationId: string | null;
        actionId: string | null;
        rating: number;
        feedbackText: string | null;
        isUseful: boolean;
        isAccurate: boolean;
    }>;
    findFeedback(tenantId: string): Promise<({
        aiGeneration: {
            id: string;
            createdAt: Date;
            status: string;
            promptVersion: string;
            modelUsed: string;
            sourceModule: string;
            fallbackUsed: boolean;
        };
    } & {
        id: string;
        createdAt: Date;
        tenantId: string;
        createdBy: string;
        aiGenerationId: string;
        recommendationId: string | null;
        actionId: string | null;
        rating: number;
        feedbackText: string | null;
        isUseful: boolean;
        isAccurate: boolean;
    })[]>;
    getMonitoring(tenantId: string): Promise<AiMonitoringMetrics>;
    getFeedbackSummaryForPrompt(tenantId: string): Promise<FeedbackPromptSummary>;
    applyFeedbackToRecommendations(tenantId: string, recommendations: FeedbackAwareRecommendation[]): Promise<FeedbackAwareRecommendation[]>;
    attachGenerationId<T extends FeedbackAwareRecommendation>(recommendations: T[], aiGenerationId?: string | null): T[];
    private resolveFeedbackGenerationId;
    private toJsonValue;
    private downgradePriority;
    private buildGenerationStatusBreakdown;
    private buildActionStatusBreakdown;
    private buildSourceModuleBreakdown;
    private rate;
    private round;
    private roundNullable;
}
