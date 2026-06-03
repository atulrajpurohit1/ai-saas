import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { AiExecutiveCenterService } from './ai-executive-center.service';
export declare class AiExecutiveCenterController {
    private readonly executiveCenterService;
    constructor(executiveCenterService: AiExecutiveCenterService);
    dashboard(user: ActiveUser): Promise<import("./ai-executive-center.types").AiExecutiveCenterDashboard>;
    summary(user: ActiveUser): Promise<{
        generatedAt: string;
        source: "ai_assisted" | "rule_based";
        executiveSummary: string;
        businessHealth: import("./ai-executive-center.types").BusinessHealthOverview;
    }>;
    risks(user: ActiveUser): Promise<{
        generatedAt: string;
        risks: import("./ai-executive-center.types").ExecutiveRiskItem[];
        operationsRisk: import("./ai-executive-center.types").OperationsRiskOverview;
        clientRiskValue: import("./ai-executive-center.types").ClientRiskValueOverview;
    }>;
    opportunities(user: ActiveUser): Promise<{
        generatedAt: string;
        opportunities: import("./ai-executive-center.types").ExecutiveOpportunityItem[];
        clientRiskValue: import("./ai-executive-center.types").ClientRiskValueOverview;
    }>;
    recommendations(user: ActiveUser): Promise<{
        generatedAt: string;
        recommendations: import("../ai-insights/ai-insights.types").AiRecommendation[];
    }>;
}
