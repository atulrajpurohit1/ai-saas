import { PrismaService } from '../prisma/prisma.service';
type PlanKey = 'free' | 'starter' | 'growth' | 'enterprise';
type LimitKey = 'adminUsers' | 'clientUsers' | 'branches' | 'leads' | 'deals';
type PlanLimits = Record<LimitKey, number | null>;
export declare class BillingService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    getTenantBilling(tenantId: string): Promise<{
        tenant: {
            id: string;
            slug: string;
            name: string;
            createdAt: Date;
        } | null;
        plan: {
            key: PlanKey;
            name: string;
            monthlyPrice: number | null;
            source: string;
        };
        limits: Record<string, any>;
        features: {
            salesAccelerator: boolean;
            salesAutomation: boolean;
            publicApi: boolean;
            customDomains: boolean;
            prioritySupport: boolean;
        };
        availablePlans: {
            key: string;
            name: string;
            monthlyPrice: number | null;
            limits: PlanLimits;
        }[];
    }>;
    assertCanAddAdminUser(tenantId: string): Promise<void>;
    assertCanAddClientUser(tenantId: string): Promise<void>;
    private assertWithinLimit;
    private usage;
    private planKeyForTenant;
    private planSource;
    private isPlanKey;
    private featuresForPlan;
}
export {};
