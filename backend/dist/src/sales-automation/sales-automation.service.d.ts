import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
export interface AutomationRunSummary {
    tenantId?: string;
    scannedDeals: number;
    createdActivities: number;
    skippedDeals: number;
    errors: Array<{
        dealId?: string;
        message: string;
    }>;
}
export declare class SalesAutomationService implements OnModuleInit, OnModuleDestroy {
    private readonly prisma;
    private readonly auditService;
    private readonly logger;
    private timer;
    private lastRunAt;
    private lastRunSummary;
    private running;
    constructor(prisma: PrismaService, auditService: AuditService);
    onModuleInit(): void;
    onModuleDestroy(): void;
    getStatus(): {
        enabled: boolean;
        intervalMinutes: number;
        running: boolean;
        lastRunAt: Date | null;
        lastRunSummary: AutomationRunSummary | null;
        marker: string;
    };
    runAllTenants(): Promise<AutomationRunSummary>;
    runForTenant(tenantId: string, userId?: string): Promise<AutomationRunSummary>;
    private followUpDecision;
    private intervalMinutes;
    private isDisabled;
    private emptySummary;
}
