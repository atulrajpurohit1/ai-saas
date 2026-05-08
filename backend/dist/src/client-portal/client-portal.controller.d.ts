import { PrismaService } from '../prisma/prisma.service';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { AuditService } from '../audit/audit.service';
export declare class ClientPortalController {
    private prisma;
    private auditService;
    constructor(prisma: PrismaService, auditService: AuditService);
    private checkClient;
    getProposals(user: ActiveUser): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        status: string;
        leadId: string | null;
        clientId: string | null;
        title: string;
        content: string;
        dealId: string | null;
    }[]>;
    getProposal(user: ActiveUser, id: string): Promise<{
        versions: {
            id: string;
            createdAt: Date;
            content: string;
            versionNumber: number;
            proposalId: string;
        }[];
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        status: string;
        leadId: string | null;
        clientId: string | null;
        title: string;
        content: string;
        dealId: string | null;
    }>;
    approveProposal(user: ActiveUser, id: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        status: string;
        leadId: string | null;
        clientId: string | null;
        title: string;
        content: string;
        dealId: string | null;
    }>;
    rejectProposal(user: ActiveUser, id: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        status: string;
        leadId: string | null;
        clientId: string | null;
        title: string;
        content: string;
        dealId: string | null;
    }>;
    getComments(user: ActiveUser, id: string): Promise<{
        id: string;
        createdAt: Date;
        tenantId: string;
        userId: string | null;
        content: string;
        proposalId: string;
        clientUserId: string | null;
    }[]>;
    addComment(user: ActiveUser, id: string, content: string): Promise<{
        id: string;
        createdAt: Date;
        tenantId: string;
        userId: string | null;
        content: string;
        proposalId: string;
        clientUserId: string | null;
    }>;
    getTimeline(user: ActiveUser, id: string): Promise<{
        id: string;
        createdAt: Date;
        tenantId: string;
        userId: string | null;
        action: string;
        entityType: string;
        entityId: string | null;
        details: string | null;
    }[]>;
    getDocuments(user: ActiveUser): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        tenantId: string;
        clientId: string;
        url: string;
        description: string | null;
        uploadedBy: string;
    }[]>;
    getProfile(user: ActiveUser): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        email: string;
        tenantId: string;
        phone: string | null;
        companyName: string | null;
    }>;
}
