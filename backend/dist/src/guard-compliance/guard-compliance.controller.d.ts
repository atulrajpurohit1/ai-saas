import { Response } from 'express';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { GuardComplianceService } from './guard-compliance.service';
import { CreateGuardComplianceDto } from './dto/create-guard-compliance.dto';
import { UpdateGuardComplianceDto } from './dto/update-guard-compliance.dto';
export declare class GuardComplianceController {
    private readonly guardComplianceService;
    constructor(guardComplianceService: GuardComplianceService);
    findAll(user: ActiveUser, guardId?: string): Promise<{
        id: string;
        guardId: string;
        guardName: string;
        type: string;
        status: import("./compliance-status.util").ComplianceStatus;
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
    create(user: ActiveUser, dto: CreateGuardComplianceDto): Promise<{
        id: string;
        guardId: string;
        guardName: string;
        type: string;
        status: import("./compliance-status.util").ComplianceStatus;
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
        status: import("./compliance-status.util").ComplianceStatus;
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
    uploadDocument(user: ActiveUser, id: string, file: Express.Multer.File): Promise<{
        id: string;
        guardId: string;
        guardName: string;
        type: string;
        status: import("./compliance-status.util").ComplianceStatus;
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
    downloadDocument(user: ActiveUser, id: string, res: Response): Promise<void>;
}
