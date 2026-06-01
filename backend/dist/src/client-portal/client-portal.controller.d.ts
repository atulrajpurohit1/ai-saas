import { PrismaService } from '../prisma/prisma.service';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { AuditService } from '../audit/audit.service';
import { ProposalsService } from '../proposals/proposals.service';
import { Response as ExpressResponse } from 'express';
export declare class ClientPortalController {
    private prisma;
    private auditService;
    private proposalsService;
    constructor(prisma: PrismaService, auditService: AuditService, proposalsService: ProposalsService);
    private checkClient;
    getProposals(user: ActiveUser): Promise<{
        id: string;
        status: string;
        tenantId: string;
        createdAt: Date;
        updatedAt: Date;
        title: string;
        clientId: string | null;
        leadId: string | null;
        content: string;
        dealId: string | null;
    }[]>;
    getProposal(user: ActiveUser, id: string): Promise<{
        versions: {
            id: string;
            createdAt: Date;
            content: string;
            proposalId: string;
            versionNumber: number;
        }[];
    } & {
        id: string;
        status: string;
        tenantId: string;
        createdAt: Date;
        updatedAt: Date;
        title: string;
        clientId: string | null;
        leadId: string | null;
        content: string;
        dealId: string | null;
    }>;
    exportProposal(user: ActiveUser, id: string, res: ExpressResponse): Promise<ExpressResponse<any, Record<string, any>>>;
    approveProposal(user: ActiveUser, id: string): Promise<{
        id: string;
        status: string;
        tenantId: string;
        createdAt: Date;
        updatedAt: Date;
        title: string;
        clientId: string | null;
        leadId: string | null;
        content: string;
        dealId: string | null;
    }>;
    rejectProposal(user: ActiveUser, id: string): Promise<{
        id: string;
        status: string;
        tenantId: string;
        createdAt: Date;
        updatedAt: Date;
        title: string;
        clientId: string | null;
        leadId: string | null;
        content: string;
        dealId: string | null;
    }>;
    getComments(user: ActiveUser, id: string): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        userId: string | null;
        content: string;
        proposalId: string;
        clientUserId: string | null;
    }[]>;
    addComment(user: ActiveUser, id: string, content: string): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        userId: string | null;
        content: string;
        proposalId: string;
        clientUserId: string | null;
    }>;
    getTimeline(user: ActiveUser, id: string): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        action: string;
        entityType: string;
        userId: string | null;
        entityId: string | null;
        details: string | null;
    }[]>;
    getDocuments(user: ActiveUser): Promise<{
        name: string;
        id: string;
        tenantId: string;
        createdAt: Date;
        clientId: string;
        description: string | null;
        url: string;
        uploadedBy: string;
    }[]>;
    getProfile(user: ActiveUser): Promise<{
        name: string;
        id: string;
        tenantId: string;
        createdAt: Date;
        updatedAt: Date;
        email: string;
        companyName: string | null;
        phone: string | null;
    }>;
}
