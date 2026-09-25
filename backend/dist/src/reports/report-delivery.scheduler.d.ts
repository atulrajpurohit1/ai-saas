import { PrismaService } from '../prisma/prisma.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { ReportsService } from './reports.service';
export declare class ReportDeliveryScheduler {
    private readonly prisma;
    private readonly reports;
    private readonly entitlements;
    private readonly logger;
    private running;
    constructor(prisma: PrismaService, reports: ReportsService, entitlements: EntitlementsService);
    sweep(): Promise<void>;
    deliverPending(): Promise<{
        considered: number;
        sent: number;
    }>;
}
