import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { AiInsightsService } from './ai-insights.service';
import { RevenueInsightsService } from './revenue-insights.service';
export declare class AiInsightsController {
    private readonly aiInsightsService;
    private readonly revenueInsightsService;
    constructor(aiInsightsService: AiInsightsService, revenueInsightsService: RevenueInsightsService);
    dashboard(user: ActiveUser): Promise<import("./ai-insights.types").AiInsightsDashboard>;
    clients(user: ActiveUser): Promise<import("./ai-insights.types").ClientInsightsResponse>;
    guards(user: ActiveUser): Promise<import("./ai-insights.types").GuardInsightsResponse>;
    sites(user: ActiveUser): Promise<import("./ai-insights.types").SiteInsightsResponse>;
    billing(user: ActiveUser): Promise<import("./ai-insights.types").BillingInsightsResponse>;
    incidents(user: ActiveUser): Promise<import("./ai-insights.types").IncidentInsightsResponse>;
    revenue(user: ActiveUser): Promise<import("./ai-insights.types").RevenueInsightsDashboard>;
    contracts(user: ActiveUser): Promise<import("./ai-insights.types").ContractIntelligenceResponse>;
    clientValue(user: ActiveUser): Promise<import("./ai-insights.types").ClientValueAnalysisResponse>;
    renewals(user: ActiveUser): Promise<import("./ai-insights.types").RenewalOpportunitiesResponse>;
    recommendations(user: ActiveUser): Promise<import("./ai-insights.types").FinancialRecommendationsResponse>;
}
