import { PrismaService } from '../prisma/prisma.service';
export declare class EmailService {
    private prisma;
    private transporter;
    constructor(prisma: PrismaService);
    sendProposalEmail(tenantId: string, leadId: string): Promise<{
        messageId: any;
        previewUrl: string | false;
        status: string;
    }>;
    sendBulkProposalEmails(tenantId: string): Promise<{
        sentCount: number;
        totalLeads: number;
        skippedMissingEmail: number;
        skippedMissingProposal: number;
        results: any[];
    }>;
}
