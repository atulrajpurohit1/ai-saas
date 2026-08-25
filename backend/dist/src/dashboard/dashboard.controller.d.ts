import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { DashboardService } from './dashboard.service';
export declare class DashboardController {
    private readonly dashboardService;
    constructor(dashboardService: DashboardService);
    getSummary(user: ActiveUser): Promise<{
        leads: {
            weeklyTrend: {
                weekStart: string;
                count: number;
            }[];
            last7Days: number;
            previous7Days: number;
            deltaPct: number | null;
            total: number;
        };
        deals: {
            byStage: {
                stage: string;
                count: number;
            }[];
            last7Days: number;
            previous7Days: number;
            deltaPct: number | null;
            total: number;
            active: number;
        };
        proposals: {
            last7Days: number;
            previous7Days: number;
            deltaPct: number | null;
            total: number;
            sent: number;
        };
    }>;
}
