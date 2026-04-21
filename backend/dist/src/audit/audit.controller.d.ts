import { AuditService } from './audit.service';
import { Request } from 'express';
export declare class AuditController {
    private readonly auditService;
    constructor(auditService: AuditService);
    findAll(req: Request): Promise<{
        id: string;
        createdAt: Date;
        tenantId: string;
        userId: string | null;
        action: string;
        entityType: string;
        entityId: string | null;
        details: string | null;
    }[]>;
}
