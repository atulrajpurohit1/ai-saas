import { PrismaService } from '../prisma/prisma.service';
export declare class DashboardService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    getSummary(tenantId: string): Promise<{
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
