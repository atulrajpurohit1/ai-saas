import { AiInsightsService } from '../ai-insights/ai-insights.service';
import { RecommendationService } from '../ai-insights/recommendation.service';
import { RevenueInsightsService } from '../ai-insights/revenue-insights.service';
import { PrismaService } from '../prisma/prisma.service';
import { CopilotStructuredResult } from './ai-copilot.types';
export declare class CopilotQueryService {
    private readonly prisma;
    private readonly aiInsightsService;
    private readonly revenueInsightsService;
    private readonly recommendationService;
    constructor(prisma: PrismaService, aiInsightsService: AiInsightsService, revenueInsightsService: RevenueInsightsService, recommendationService: RecommendationService);
    answerQuestion(tenantId: string, userId: string, question: string): Promise<CopilotStructuredResult>;
    private detectIntent;
    private answerIncidentOrSiteQuestion;
    private answerBillingQuestion;
    private answerStaffingQuestion;
    private answerRevenueQuestion;
    private answerReportsQuestion;
    private answerGeneralQuestion;
    private getMissedShiftsLastWeek;
    private source;
    private action;
    private clientName;
    private formatCurrency;
}
