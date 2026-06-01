import { AiService } from '../ai/ai.service';
import { PrismaService } from '../prisma/prisma.service';
import { GuardRecommendation, SchedulingOverview } from './ai-insights.types';
export declare class RecommendationService {
    private readonly prisma;
    private readonly aiService;
    constructor(prisma: PrismaService, aiService: AiService);
    recommendGuards(tenantId: string, shiftId: string, includeAiExplanation?: boolean): Promise<GuardRecommendation[]>;
    getSchedulingOverview(tenantId: string): Promise<SchedulingOverview>;
    private buildSchedulingOverviewRecommendations;
    private datesOverlap;
    private isUnavailableForShift;
    private isLateCheckIn;
    private roundScore;
    private roundPercent;
    private fallbackRecommendationExplanation;
    private explainRecommendation;
}
