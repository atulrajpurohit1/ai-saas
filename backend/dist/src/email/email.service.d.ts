import { BrandingService } from '../branding/branding.service';
import { PrismaService } from '../prisma/prisma.service';
export declare class EmailService {
    private prisma;
    private brandingService;
    private transporter;
    constructor(prisma: PrismaService, brandingService: BrandingService);
    sendProposalEmail(tenantId: string, leadId: string): Promise<{
        messageId: any;
        previewUrl: string | false;
        status: string;
    }>;
    sendVendorInvitationEmail(tenantId: string, params: {
        vendorEmail: string;
        vendorCompanyName: string;
        rfpTitle: string;
        dueDate: Date | null;
        invitationUrl: string;
    }): Promise<{
        messageId: any;
        previewUrl: string | false;
    }>;
    sendContractAwardEmail(tenantId: string, params: {
        vendorEmail: string;
        vendorCompanyName: string;
        rfpTitle: string;
        awardNotes?: string | null;
    }): Promise<{
        messageId: any;
        previewUrl: string | false;
    }>;
    sendVendorRejectionEmail(tenantId: string, params: {
        vendorEmail: string;
        vendorCompanyName: string;
        rfpTitle: string;
        reason?: string | null;
    }): Promise<{
        messageId: any;
        previewUrl: string | false;
    }>;
    sendBulkProposalEmails(tenantId: string): Promise<{
        sentCount: number;
        totalLeads: number;
        skippedMissingEmail: number;
        skippedMissingProposal: number;
        results: any[];
    }>;
}
