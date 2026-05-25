import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
type NoteEntityType = 'lead' | 'deal';
export declare class NotesService {
    private prisma;
    private auditService;
    constructor(prisma: PrismaService, auditService: AuditService);
    private attachCreatedBy;
    private ensureEntityExists;
    create(data: {
        content: string;
        leadId?: string;
        dealId?: string;
        tenantId: string;
        userId?: string;
    }): Promise<{
        createdBy: {
            id: string;
            name: string | null;
            email: string;
        } | null;
        id: string;
        content: string;
        leadId: string | null;
        dealId: string | null;
        tenantId: string;
        createdAt: Date;
    }>;
    findByEntity(entityId: string, type: NoteEntityType, tenantId: string): Promise<{
        createdBy: {
            id: string;
            name: string | null;
            email: string;
        } | null;
        id: string;
        content: string;
        leadId: string | null;
        dealId: string | null;
        tenantId: string;
        createdAt: Date;
    }[]>;
    remove(id: string, tenantId: string, userId?: string): Promise<{
        success: boolean;
    }>;
}
export {};
