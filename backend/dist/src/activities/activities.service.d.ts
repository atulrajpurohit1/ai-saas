import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
export declare class ActivitiesService {
    private prisma;
    private auditService;
    constructor(prisma: PrismaService, auditService: AuditService);
    create(data: {
        type: string;
        subject: string;
        description?: string;
        dueDate?: Date;
        dealId?: string;
        tenantId: string;
        userId?: string;
    }): Promise<{
        id: string;
        createdAt: Date;
        tenantId: string;
        status: string;
        dealId: string | null;
        description: string | null;
        dueDate: Date | null;
        subject: string;
        type: string;
    }>;
    findAll(tenantId: string, dealId?: string): Promise<{
        id: string;
        createdAt: Date;
        tenantId: string;
        status: string;
        dealId: string | null;
        description: string | null;
        dueDate: Date | null;
        subject: string;
        type: string;
    }[]>;
    updateStatus(id: string, status: string, tenantId: string, userId?: string): Promise<{
        id: string;
        createdAt: Date;
        tenantId: string;
        status: string;
        dealId: string | null;
        description: string | null;
        dueDate: Date | null;
        subject: string;
        type: string;
    }>;
}
