import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { CommandCenterService } from './command-center.service';
export declare class CommandCenterController {
    private readonly commandCenterService;
    constructor(commandCenterService: CommandCenterService);
    getDashboard(user: ActiveUser): Promise<import("./command-center.types").CommandCenterDashboard>;
    getSummary(user: ActiveUser): Promise<import("./command-center.types").DailySummary>;
    getRecommendations(user: ActiveUser): Promise<import("../ai-insights/ai-insights.types").AiRecommendation[]>;
    getRisks(user: ActiveUser): Promise<{
        sites: import("./command-center.types").CommandCenterRiskItem[];
        clients: import("./command-center.types").CommandCenterRiskItem[];
        contracts: import("./command-center.types").CommandCenterRiskItem[];
        totalHighRisk: number;
        totalCritical: number;
    }>;
}
