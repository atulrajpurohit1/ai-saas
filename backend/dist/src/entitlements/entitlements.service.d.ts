import { ServiceModule } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
export declare class EntitlementsService {
    private readonly prisma;
    private readonly logger;
    private readonly cache;
    constructor(prisma: PrismaService);
    modulesForTenant(tenantId: string): Promise<Set<ServiceModule>>;
    hasModule(tenantId: string, module: ServiceModule): Promise<boolean>;
    hasAnyModule(tenantId: string, modules: ServiceModule[]): Promise<boolean>;
    filterPermissionKeys(tenantId: string, keys: string[], permissionModuleByKey: Map<string, string>): Promise<string[]>;
    summaryForTenant(tenantId: string): Promise<{
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
    invalidate(tenantId: string): void;
    private remember;
}
