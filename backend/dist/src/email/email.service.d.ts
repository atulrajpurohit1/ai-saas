import { BrandingService } from '../branding/branding.service';
import { PrismaService } from '../prisma/prisma.service';
export declare class EmailService {
    private prisma;
    private brandingService;
    private transporter;
    private readonly envelopeFrom;
    constructor(prisma: PrismaService, brandingService: BrandingService);
    private senderFor;
    sendProposalEmail(tenantId: string, leadId: string): Promise<{
        messageId: any;
        previewUrl: string | false;
        status: string;
    }>;
    sendOtpEmail(tenantId: string | null, params: {
        email: string;
        name?: string | null;
        code: string;
        expiresInMinutes: number;
    }): Promise<{
        messageId: any;
        previewUrl: string | false;
    }>;
    sendPasswordResetOtpEmail(tenantId: string | null, params: {
        email: string;
        name?: string | null;
        code: string;
        expiresInMinutes: number;
    }): Promise<{
        messageId: any;
        previewUrl: string | false;
    }>;
    private passwordResetOtpEmailBody;
    private plainPasswordResetOtpEmailHtml;
    private otpEmailBody;
    private plainOtpEmailHtml;
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
}
