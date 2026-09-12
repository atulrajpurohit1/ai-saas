import { PrismaService } from '../prisma/prisma.service';
import { CreateProposalDto } from './dto/create-proposal.dto';
import { UpdateProposalDto } from './dto/update-proposal.dto';
import { AiService } from '../ai/ai.service';
import { AuditService } from '../audit/audit.service';
import { BrandingService } from '../branding/branding.service';
export declare class ProposalsService {
    private prisma;
    private aiService;
    private auditService;
    private brandingService;
    constructor(prisma: PrismaService, aiService: AiService, auditService: AuditService, brandingService: BrandingService);
    private ensureLeadBelongsToTenant;
    private ensureDealBelongsToTenant;
    private ensureClientBelongsToTenant;
    private buildPdfBuffer;
    create(tenantId: string, createProposalDto: CreateProposalDto, userId?: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        status: string;
        title: string;
        content: string;
        dealId: string | null;
        leadId: string | null;
        clientId: string | null;
    }>;
    findAll(tenantId: string): Promise<({
        _count: {
            versions: number;
        };
        lead: {
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            email: string | null;
            tenantId: string;
            status: string;
            company: string;
        } | null;
        deal: {
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            tenantId: string;
            leadId: string;
            clientId: string | null;
            stage: string;
        } | null;
        client: {
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
        } | null;
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        status: string;
        title: string;
        content: string;
        dealId: string | null;
        leadId: string | null;
        clientId: string | null;
    })[]>;
    findOne(tenantId: string, id: string, clientId?: string): Promise<{
        lead: {
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            email: string | null;
            tenantId: string;
            status: string;
            company: string;
        } | null;
        deal: {
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            tenantId: string;
            leadId: string;
            clientId: string | null;
            stage: string;
        } | null;
        versions: {
            id: string;
            createdAt: Date;
            content: string;
            proposalId: string;
            versionNumber: number;
        }[];
        client: {
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
        } | null;
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        status: string;
        title: string;
        content: string;
        dealId: string | null;
        leadId: string | null;
        clientId: string | null;
    }>;
    update(tenantId: string, id: string, updateProposalDto: UpdateProposalDto, userId?: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        status: string;
        title: string;
        content: string;
        dealId: string | null;
        leadId: string | null;
        clientId: string | null;
    }>;
    duplicate(tenantId: string, id: string, userId?: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        status: string;
        title: string;
        content: string;
        dealId: string | null;
        leadId: string | null;
        clientId: string | null;
    }>;
    export(tenantId: string, id: string, userId?: string, clientId?: string): Promise<Buffer>;
    generateForLead(tenantId: string, leadId: string, userId?: string, clientId?: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        status: string;
        title: string;
        content: string;
        dealId: string | null;
        leadId: string | null;
        clientId: string | null;
    }>;
    getComments(tenantId: string, id: string): Promise<{
        id: string;
        createdAt: Date;
        tenantId: string;
        content: string;
        proposalId: string;
        userId: string | null;
        clientUserId: string | null;
    }[]>;
    addComment(tenantId: string, id: string, userId: string, content: string): Promise<{
        id: string;
        createdAt: Date;
        tenantId: string;
        content: string;
        proposalId: string;
        userId: string | null;
        clientUserId: string | null;
    }>;
    remove(tenantId: string, id: string, userId?: string): Promise<{
        success: boolean;
    }>;
    logAction(tenantId: string, userId: string, entityId: string, action: string, details?: string): Promise<void>;
}
