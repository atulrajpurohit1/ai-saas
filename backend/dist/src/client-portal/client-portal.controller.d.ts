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
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        clientId: string | null;
        content: string;
        title: string;
        status: string;
        dealId: string | null;
        leadId: string | null;
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
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        clientId: string | null;
        content: string;
        title: string;
        status: string;
        dealId: string | null;
        leadId: string | null;
    }>;
    exportProposal(user: ActiveUser, id: string, res: ExpressResponse): Promise<ExpressResponse<any, Record<string, any>>>;
    approveProposal(user: ActiveUser, id: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        clientId: string | null;
        content: string;
        title: string;
        status: string;
        dealId: string | null;
        leadId: string | null;
    }>;
    rejectProposal(user: ActiveUser, id: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        clientId: string | null;
        content: string;
        title: string;
        status: string;
        dealId: string | null;
        leadId: string | null;
    }>;
    getComments(user: ActiveUser, id: string): Promise<{
        id: string;
        createdAt: Date;
        tenantId: string;
        content: string;
        proposalId: string;
        userId: string | null;
        clientUserId: string | null;
    }[]>;
    addComment(user: ActiveUser, id: string, content: string): Promise<{
        id: string;
        createdAt: Date;
        tenantId: string;
        content: string;
        proposalId: string;
        userId: string | null;
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
        description: string | null;
        url: string;
        uploadedBy: string;
    }[]>;
    getProfile(user: ActiveUser): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        email: string;
        tenantId: string;
        branchId: string | null;
        companyName: string | null;
        phone: string | null;
        billingNotes: string | null;
        internalNotes: string | null;
    }>;
}
