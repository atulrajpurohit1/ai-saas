import { PrismaService } from '../prisma/prisma.service';
import { CreateProposalDto } from './dto/create-proposal.dto';
import { UpdateProposalDto } from './dto/update-proposal.dto';
import { AiService } from '../ai/ai.service';
export declare class ProposalsService {
    private prisma;
    private aiService;
    constructor(prisma: PrismaService, aiService: AiService);
    create(tenantId: string, createProposalDto: CreateProposalDto): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        status: string;
        leadId: string | null;
        title: string;
        content: string;
    }>;
    findAll(tenantId: string): Promise<({
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
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        status: string;
        leadId: string | null;
        title: string;
        content: string;
    })[]>;
    findOne(tenantId: string, id: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        status: string;
        leadId: string | null;
        title: string;
        content: string;
    }>;
    update(tenantId: string, id: string, updateProposalDto: UpdateProposalDto): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        status: string;
        leadId: string | null;
        title: string;
        content: string;
    }>;
    duplicate(tenantId: string, id: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        status: string;
        leadId: string | null;
        title: string;
        content: string;
    }>;
    generateForLead(tenantId: string, leadId: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        status: string;
        leadId: string | null;
        title: string;
        content: string;
    }>;
    generateBulkProposals(tenantId: string): Promise<{
        generatedCount: number;
        totalProcessed: number;
    }>;
}
