import { AuditService } from '../audit/audit.service';
import { BrandingService } from '../branding/branding.service';
import { PrismaService } from '../prisma/prisma.service';
export declare class SalesDeliveryService {
    private readonly prisma;
    private readonly brandingService;
    private readonly auditService;
    private transporter;
    constructor(prisma: PrismaService, brandingService: BrandingService, auditService: AuditService);
    draftDealFollowUp(tenantId: string, dealId: string): Promise<{
        dealId: string;
        dealName: string;
        to: string | null;
        contactName: string;
        company: string;
        subject: string;
        body: string;
        nextActivity: {
            id: any;
            subject: any;
            dueDate: Date | null;
            description: any;
        } | null;
    }>;
    sendDealFollowUp(tenantId: string, dealId: string, userId?: string): Promise<{
        status: string;
        messageId: any;
        previewUrl: string | false;
        activityId: string;
    }>;
    calendarForDeal(tenantId: string, dealId: string): Promise<{
        filename: string;
        content: string;
    }>;
    private getDealContext;
    private nextActivity;
    private tomorrow;
    private icsDate;
    private icsText;
    private slug;
    private escapeHtml;
}
