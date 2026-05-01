import { PrismaService } from '../prisma/prisma.service';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { AuditService } from '../audit/audit.service';
export declare class ClientPortalController {
    private prisma;
    private auditService;
    constructor(prisma: PrismaService, auditService: AuditService);
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
}
