import { ServiceModule, SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { AuditService } from '../audit/audit.service';
export interface ProvisionInput {
    tenantId: string;
    modules: ServiceModule[];
    status: SubscriptionStatus;
    trialEndsAt?: Date | null;
    currentPeriodEnd?: Date | null;
    cancelAtPeriodEnd?: boolean;
    providerCustomerId?: string | null;
    providerSubscriptionId?: string | null;
    reason?: string;
}
export declare class SubscriptionProvisioningService {
    private readonly prisma;
    private readonly entitlements;
    private readonly audit;
    private readonly logger;
    constructor(prisma: PrismaService, entitlements: EntitlementsService, audit: AuditService);
    provision(input: ProvisionInput): Promise<{
        status: import(".prisma/client").$Enums.SubscriptionStatus;
        trialEndsAt: Date | null;
        currentPeriodEnd: Date | null;
        cancelAtPeriodEnd: boolean;
        modules: {
            key: import(".prisma/client").$Enums.ServiceModule;
            name: string;
            active: boolean;
        }[];
    }>;
    cancel(tenantId: string, reason?: string): Promise<void>;
    setStatus(tenantId: string, status: SubscriptionStatus, reason?: string): Promise<void>;
    tenantForProviderIds(ids: {
        customerId?: string | null;
        subscriptionId?: string | null;
    }): Promise<string | null>;
}
