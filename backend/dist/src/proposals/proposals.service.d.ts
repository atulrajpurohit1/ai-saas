import { PrismaService } from '../prisma/prisma.service';
import { CreateProposalDto } from './dto/create-proposal.dto';
import { UpdateProposalDto } from './dto/update-proposal.dto';
import { AiService } from '../ai/ai.service';
import { AuditService } from '../audit/audit.service';
export declare class ProposalsService {
    private prisma;
    private aiService;
    private auditService;
    constructor(prisma: PrismaService, aiService: AiService, auditService: AuditService);
    private ensureLeadBelongsToTenant;
    private ensureDealBelongsToTenant;
    private ensureClientBelongsToTenant;
    private buildPdfBuffer;
    create(tenantId: string, createProposalDto: CreateProposalDto, userId?: string): Promise<{
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
    findAll(tenantId: string): Promise<({
        lead: {
            name: string;
            id: string;
            company: string;
            status: string;
            tenantId: string;
            createdAt: Date;
            updatedAt: Date;
            email: string | null;
        } | null;
        client: {
            name: string;
            id: string;
            tenantId: string;
            createdAt: Date;
            updatedAt: Date;
            email: string;
            companyName: string | null;
            phone: string | null;
        } | null;
        _count: {
            versions: number;
        };
        deal: {
            name: string;
            id: string;
            tenantId: string;
            createdAt: Date;
            updatedAt: Date;
            clientId: string | null;
            stage: string;
            leadId: string;
        } | null;
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
    })[]>;
    findOne(tenantId: string, id: string, clientId?: string): Promise<{
        lead: {
            name: string;
            id: string;
            company: string;
            status: string;
            tenantId: string;
            createdAt: Date;
            updatedAt: Date;
            email: string | null;
        } | null;
        client: {
            name: string;
            id: string;
            tenantId: string;
            createdAt: Date;
            updatedAt: Date;
            email: string;
            companyName: string | null;
            phone: string | null;
        } | null;
        deal: {
            name: string;
            id: string;
            tenantId: string;
            createdAt: Date;
            updatedAt: Date;
            clientId: string | null;
            stage: string;
            leadId: string;
        } | null;
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
    update(tenantId: string, id: string, updateProposalDto: UpdateProposalDto, userId?: string): Promise<{
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
    duplicate(tenantId: string, id: string, userId?: string): Promise<{
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
    export(tenantId: string, id: string, userId?: string, clientId?: string): Promise<Buffer>;
    generateForLead(tenantId: string, leadId: string, userId?: string, clientId?: string): Promise<{
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
    generateBulkProposals(tenantId: string, userId?: string): Promise<{
        generatedCount: number;
        totalProcessed: number;
    }>;
    getComments(tenantId: string, id: string): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        userId: string | null;
        content: string;
        proposalId: string;
        clientUserId: string | null;
    }[]>;
    addComment(tenantId: string, id: string, userId: string, content: string): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        userId: string | null;
        content: string;
        proposalId: string;
        clientUserId: string | null;
    }>;
    logAction(tenantId: string, userId: string, entityId: string, action: string, details?: string): Promise<void>;
}
