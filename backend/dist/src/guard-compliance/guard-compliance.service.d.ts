import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { CreateGuardComplianceDto } from './dto/create-guard-compliance.dto';
import { UpdateGuardComplianceDto } from './dto/update-guard-compliance.dto';
import { ComplianceStatus } from './compliance-status.util';
export declare class GuardComplianceService {
    private prisma;
    private auditService;
    constructor(prisma: PrismaService, auditService: AuditService);
    private findGuardOrThrow;
    private findRecordOrThrow;
    private assertDateOrder;
    private statusOf;
    private serialize;
    create(user: ActiveUser, dto: CreateGuardComplianceDto): Promise<{
        id: string;
        guardId: string;
        guardName: string;
        type: string;
        status: ComplianceStatus;
        documentNumber: string | null;
        issuingAuthority: string | null;
        issueDate: Date | null;
        expirationDate: Date | null;
        notes: string | null;
        hasDocument: boolean;
        fileName: string | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    update(user: ActiveUser, id: string, dto: UpdateGuardComplianceDto): Promise<{
        id: string;
        guardId: string;
        guardName: string;
        type: string;
        status: ComplianceStatus;
        documentNumber: string | null;
        issuingAuthority: string | null;
        issueDate: Date | null;
        expirationDate: Date | null;
        notes: string | null;
        hasDocument: boolean;
        fileName: string | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    remove(user: ActiveUser, id: string): Promise<{
        success: boolean;
    }>;
    findAllForTenant(user: ActiveUser, guardId?: string): Promise<{
        id: string;
        guardId: string;
        guardName: string;
        type: string;
        status: ComplianceStatus;
        documentNumber: string | null;
        issuingAuthority: string | null;
        issueDate: Date | null;
        expirationDate: Date | null;
        notes: string | null;
        hasDocument: boolean;
        fileName: string | null;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
    attachDocument(user: ActiveUser, id: string, file: Express.Multer.File): Promise<{
        id: string;
        guardId: string;
        guardName: string;
        type: string;
        status: ComplianceStatus;
        documentNumber: string | null;
        issuingAuthority: string | null;
        issueDate: Date | null;
        expirationDate: Date | null;
        notes: string | null;
        hasDocument: boolean;
        fileName: string | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    getDocumentForDownload(user: ActiveUser, id: string): Promise<{
        stream: import("fs").ReadStream;
        filename: string;
    }>;
}
