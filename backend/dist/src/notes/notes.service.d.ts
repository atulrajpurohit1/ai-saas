import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
export declare class NotesService {
    private prisma;
    private auditService;
    constructor(prisma: PrismaService, auditService: AuditService);
    create(data: {
        content: string;
        leadId?: string;
        dealId?: string;
        tenantId: string;
        userId?: string;
    }): Promise<{
        id: string;
        createdAt: Date;
        tenantId: string;
        leadId: string | null;
        content: string;
        dealId: string | null;
    }>;
    findByEntity(entityId: string, type: 'lead' | 'deal', tenantId: string): Promise<{
        id: string;
        createdAt: Date;
        tenantId: string;
        leadId: string | null;
        content: string;
        dealId: string | null;
    }[]>;
    remove(id: string, tenantId: string, userId?: string): Promise<{
        success: boolean;
    }>;
}
