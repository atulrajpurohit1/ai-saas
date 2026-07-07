import { Prisma } from '@prisma/client';
import { ProspectSearchFilters } from '../ai/ai.service';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
export declare class SavedProspectSearchService {
    private readonly prisma;
    private readonly auditService;
    constructor(prisma: PrismaService, auditService: AuditService);
    list(tenantId: string): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        userId: string;
        prompt: string;
        filters: Prisma.JsonValue;
    }[]>;
    create(input: {
        tenantId: string;
        userId: string;
        name: string;
        prompt: string;
        filters: ProspectSearchFilters;
    }): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        userId: string;
        prompt: string;
        filters: Prisma.JsonValue;
    }>;
    rename(id: string, tenantId: string, userId: string, name: string): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        userId: string;
        prompt: string;
        filters: Prisma.JsonValue;
    }>;
    remove(id: string, tenantId: string, userId: string): Promise<{
        success: boolean;
    }>;
    private ensureExists;
}
