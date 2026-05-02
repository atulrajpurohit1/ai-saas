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
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        status: string;
        leadId: string | null;
        clientId: string | null;
        content: string;
        dealId: string | null;
        title: string;
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
            company: string;
            status: string;
        } | null;
        deal: {
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            tenantId: string;
            stage: string;
            leadId: string;
            clientId: string | null;
        } | null;
        client: {
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            email: string;
            tenantId: string;
            phone: string | null;
            companyName: string | null;
        } | null;
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        status: string;
        leadId: string | null;
        clientId: string | null;
        content: string;
        dealId: string | null;
        title: string;
    })[]>;
    findOne(tenantId: string, id: string): Promise<{
        lead: {
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            email: string | null;
            tenantId: string;
            company: string;
            status: string;
        } | null;
        deal: {
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            tenantId: string;
            stage: string;
            leadId: string;
            clientId: string | null;
        } | null;
        client: {
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            email: string;
            tenantId: string;
            phone: string | null;
            companyName: string | null;
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
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        status: string;
        leadId: string | null;
        clientId: string | null;
        content: string;
        dealId: string | null;
        title: string;
    }>;
    update(tenantId: string, id: string, updateProposalDto: UpdateProposalDto, userId?: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        status: string;
        leadId: string | null;
        clientId: string | null;
        content: string;
        dealId: string | null;
        title: string;
    }>;
    duplicate(tenantId: string, id: string, userId?: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        status: string;
        leadId: string | null;
        clientId: string | null;
        content: string;
        dealId: string | null;
        title: string;
    }>;
    export(tenantId: string, id: string, userId?: string): Promise<{
        content: string;
        title: string;
    }>;
    generateForLead(tenantId: string, leadId: string, userId?: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        status: string;
        leadId: string | null;
        clientId: string | null;
        content: string;
        dealId: string | null;
        title: string;
    }>;
    generateBulkProposals(tenantId: string, userId?: string): Promise<{
        generatedCount: number;
        totalProcessed: number;
    }>;
}
