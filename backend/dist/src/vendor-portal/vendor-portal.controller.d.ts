import { SubmitProposalDto } from './dto/submit-proposal.dto';
import { VendorPortalService, SubmissionFiles } from './vendor-portal.service';
export declare class VendorPortalController {
    private readonly vendorPortalService;
    constructor(vendorPortalService: VendorPortalService);
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
    submitProposal(token: string, files: SubmissionFiles, dto: SubmitProposalDto): Promise<{
        success: boolean;
    }>;
}
