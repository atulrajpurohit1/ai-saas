import { Response } from 'express';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { ClientComplianceService } from './client-compliance.service';
export declare class ClientPortalInsuranceController {
    private readonly clientComplianceService;
    constructor(clientComplianceService: ClientComplianceService);
    private getClientContext;
    findAll(user: ActiveUser): Promise<{
        id: string;
        clientId: string;
        clientName: string;
        siteId: string | null;
        siteName: string | null;
        scope: "site" | "client_wide";
        type: string;
        status: import("../guard-compliance/compliance-status.util").ComplianceStatus;
        policyNumber: string | null;
        insurer: string | null;
        coverageAmount: number | null;
        effectiveDate: Date | null;
        expirationDate: Date | null;
        notes: string | null;
        hasDocument: boolean;
        fileName: string | null;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
    downloadDocument(user: ActiveUser, id: string, res: Response): Promise<void>;
}
