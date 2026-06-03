import { CommandCenterService } from '../ai-command-center/command-center.service';
import { AiService } from '../ai/ai.service';
import { AuditService } from '../audit/audit.service';
import { AiInsightsService } from '../ai-insights/ai-insights.service';
import { AiRecommendation } from '../ai-insights/ai-insights.types';
import { RevenueInsightsService } from '../ai-insights/revenue-insights.service';
import { AiMonitoringService } from '../ai-monitoring/ai-monitoring.service';
import { PredictionEngineService } from '../ai-predictions/prediction-engine.service';
import { KnowledgeRetrievalService } from '../knowledge-base/knowledge-retrieval.service';
import { AiExecutiveCenterDashboard, BusinessHealthOverview, ClientRiskValueOverview, ExecutiveOpportunityItem, ExecutiveRiskItem, OperationsRiskOverview } from './ai-executive-center.types';
export declare class AiExecutiveCenterService {
    private readonly commandCenterService;
    private readonly predictionEngineService;
    private readonly revenueInsightsService;
    private readonly aiInsightsService;
    private readonly aiService;
    private readonly aiMonitoringService;
    private readonly auditService;
    private readonly knowledgeRetrievalService?;
    private readonly logger;
    constructor(commandCenterService: CommandCenterService, predictionEngineService: PredictionEngineService, revenueInsightsService: RevenueInsightsService, aiInsightsService: AiInsightsService, aiService: AiService, aiMonitoringService: AiMonitoringService, auditService: AuditService, knowledgeRetrievalService?: KnowledgeRetrievalService | undefined);
    getDashboard(tenantId: string, userId: string): Promise<AiExecutiveCenterDashboard>;
    getSummary(tenantId: string, userId: string): Promise<{
        generatedAt: string;
        source: "ai_assisted" | "rule_based";
        executiveSummary: string;
        businessHealth: BusinessHealthOverview;
    }>;
    getRisks(tenantId: string, userId: string): Promise<{
        generatedAt: string;
        risks: ExecutiveRiskItem[];
        operationsRisk: OperationsRiskOverview;
        clientRiskValue: ClientRiskValueOverview;
    }>;
    getOpportunities(tenantId: string, userId: string): Promise<{
        generatedAt: string;
        opportunities: ExecutiveOpportunityItem[];
        clientRiskValue: ClientRiskValueOverview;
    }>;
    getRecommendations(tenantId: string, userId: string): Promise<{
        generatedAt: string;
        recommendations: AiRecommendation[];
    }>;
    private buildDashboard;
    private loadContext;
    private buildBusinessHealth;
    private buildRevenueGrowth;
    private buildClientRiskValue;
    private buildOperationsRisk;
    private buildWorkforcePerformance;
    private buildForecastsPredictions;
    private buildRiskBoard;
    private buildOpportunityBoard;
    private buildStrategicRecommendations;
    private generateExecutiveSummary;
    private fallbackExecutiveSummary;
    private commandRiskToExecutiveRisk;
    private predictionToRisk;
    private healthComponent;
    private predictionRiskLevel;
    private healthStatus;
    private healthTone;
    private average;
    private roundRiskScore;
    private roundNumber;
    private metric;
    private formatCurrency;
}
