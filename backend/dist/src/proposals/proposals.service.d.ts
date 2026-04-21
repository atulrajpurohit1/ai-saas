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
    create(tenantId: string, createProposalDto: CreateProposalDto, userId?: string): Promise<{
        id: string;
        status: string;
        tenantId: string;
        createdAt: Date;
        updatedAt: Date;
        title: string;
        content: string;
        dealId: string | null;
        leadId: string | null;
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
        _count: {
            versions: number;
        };
        deal: {
            name: string;
            id: string;
            tenantId: string;
            createdAt: Date;
            updatedAt: Date;
            leadId: string;
            stage: string;
        } | null;
    } & {
        id: string;
        status: string;
        tenantId: string;
        createdAt: Date;
        updatedAt: Date;
        title: string;
        content: string;
        dealId: string | null;
        leadId: string | null;
    })[]>;
    findOne(tenantId: string, id: string): Promise<{
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
        deal: {
            name: string;
            id: string;
            tenantId: string;
            createdAt: Date;
            updatedAt: Date;
            leadId: string;
            stage: string;
        } | null;
        versions: {
            id: string;
            createdAt: Date;
            content: string;
            versionNumber: number;
            proposalId: string;
        }[];
    } & {
        id: string;
        status: string;
        tenantId: string;
        createdAt: Date;
        updatedAt: Date;
        title: string;
        content: string;
        dealId: string | null;
        leadId: string | null;
    }>;
    update(tenantId: string, id: string, updateProposalDto: UpdateProposalDto, userId?: string): Promise<{
        id: string;
        status: string;
        tenantId: string;
        createdAt: Date;
        updatedAt: Date;
        title: string;
        content: string;
        dealId: string | null;
        leadId: string | null;
    }>;
    duplicate(tenantId: string, id: string, userId?: string): Promise<{
        id: string;
        status: string;
        tenantId: string;
        createdAt: Date;
        updatedAt: Date;
        title: string;
        content: string;
        dealId: string | null;
        leadId: string | null;
    }>;
    export(tenantId: string, id: string, userId?: string): Promise<{
        content: string;
        title: string;
    }>;
    generateForLead(tenantId: string, leadId: string, userId?: string): Promise<{
        id: string;
        status: string;
        tenantId: string;
        createdAt: Date;
        updatedAt: Date;
        title: string;
        content: string;
        dealId: string | null;
        leadId: string | null;
    }>;
    generateBulkProposals(tenantId: string, userId?: string): Promise<{
        generatedCount: number;
        totalProcessed: number;
    }>;
}
