import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
export interface SubmissionFiles {
    proposalFile?: Express.Multer.File[];
    pricingFile?: Express.Multer.File[];
    insuranceFile?: Express.Multer.File[];
    licenseFile?: Express.Multer.File[];
}
export declare class VendorPortalService {
    private prisma;
    private auditService;
    constructor(prisma: PrismaService, auditService: AuditService);
    private findByTokenOrThrow;
    private isExpired;
    getInvitation(token: string): Promise<{
        companyName: string;
        rfpTitle: string;
        industry: string | null;
        dueDate: Date | null;
        additionalRequirements: string | null;
        securityTypes: import("@prisma/client/runtime/library").JsonValue;
        invitationStatus: import(".prisma/client").$Enums.InvitationStatus;
        alreadySubmitted: boolean;
    }>;
    markViewed(token: string): Promise<{
        success: boolean;
    }>;
    submitProposal(token: string, files: SubmissionFiles, notes: string | undefined): Promise<{
        success: boolean;
    }>;
    private cleanupUploadedFiles;
}
