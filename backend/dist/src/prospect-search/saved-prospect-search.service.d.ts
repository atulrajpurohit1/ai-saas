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
        filters: import("@prisma/client/runtime/library").JsonValue;
    }[]>;
    create(input: {
        tenantId: string;
        userId: string;
        name: string;
        prompt: string;
    }): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        userId: string;
        prompt: string;
        filters: import("@prisma/client/runtime/library").JsonValue;
    }>;
    rename(id: string, tenantId: string, userId: string, name: string): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        userId: string;
        prompt: string;
        filters: import("@prisma/client/runtime/library").JsonValue;
    }>;
    remove(id: string, tenantId: string, userId: string): Promise<{
        success: boolean;
    }>;
    private ensureExists;
}
