import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { AiInsightsService } from './ai-insights.service';
export declare class AiInsightsController {
    private readonly aiInsightsService;
    constructor(aiInsightsService: AiInsightsService);
    dashboard(user: ActiveUser): Promise<import("./ai-insights.types").AiInsightsDashboard>;
    clients(user: ActiveUser): Promise<import("./ai-insights.types").ClientInsightsResponse>;
    guards(user: ActiveUser): Promise<import("./ai-insights.types").GuardInsightsResponse>;
    sites(user: ActiveUser): Promise<import("./ai-insights.types").SiteInsightsResponse>;
    billing(user: ActiveUser): Promise<import("./ai-insights.types").BillingInsightsResponse>;
    incidents(user: ActiveUser): Promise<import("./ai-insights.types").IncidentInsightsResponse>;
}
