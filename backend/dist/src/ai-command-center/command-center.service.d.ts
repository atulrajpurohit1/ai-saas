import { AiInsightsService } from '../ai-insights/ai-insights.service';
import { RevenueInsightsService } from '../ai-insights/revenue-insights.service';
import { AiService } from '../ai/ai.service';
import { PrismaService } from '../prisma/prisma.service';
import { CommandCenterDashboard, DailySummary, CommandCenterRiskItem } from './command-center.types';
import { AiRecommendation } from '../ai-insights/ai-insights.types';
export declare class CommandCenterService {
    private readonly prisma;
    private readonly aiInsightsService;
    private readonly revenueInsightsService;
    private readonly aiService;
    private readonly logger;
    constructor(prisma: PrismaService, aiInsightsService: AiInsightsService, revenueInsightsService: RevenueInsightsService, aiService: AiService);
    getDashboard(tenantId: string, userId: string): Promise<CommandCenterDashboard>;
    getSummary(tenantId: string, userId: string): Promise<DailySummary>;
    getRecommendations(tenantId: string, userId: string): Promise<AiRecommendation[]>;
    getRisks(tenantId: string, userId: string): Promise<{
        sites: CommandCenterRiskItem[];
        clients: CommandCenterRiskItem[];
        contracts: CommandCenterRiskItem[];
        totalHighRisk: number;
        totalCritical: number;
    }>;
    private countGuardsOnDuty;
    private countOpenIncidents;
    private buildOverview;
    private buildWorkforceHealth;
    private buildFinancialHealth;
    private buildUnifiedRisks;
    private buildUnifiedRecommendations;
    private generateDailySummary;
}
