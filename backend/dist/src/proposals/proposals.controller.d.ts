import { ProposalsService } from './proposals.service';
import { CreateProposalDto } from './dto/create-proposal.dto';
import { UpdateProposalDto } from './dto/update-proposal.dto';
import { Request } from 'express';
export declare class ProposalsController {
    private readonly proposalsService;
    constructor(proposalsService: ProposalsService);
    create(req: Request, createProposalDto: CreateProposalDto): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        status: string;
        leadId: string | null;
        title: string;
        content: string;
    }>;
    findAll(req: Request): Promise<({
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
    generateProposal(req: Request, leadId: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        status: string;
        leadId: string | null;
        title: string;
        content: string;
    }>;
    generateBulkProposals(req: Request): Promise<{
        generatedCount: number;
        totalProcessed: number;
    }>;
    findOne(req: Request, id: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        status: string;
        leadId: string | null;
        title: string;
        content: string;
    }>;
    update(req: Request, id: string, updateProposalDto: UpdateProposalDto): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        status: string;
        leadId: string | null;
        title: string;
        content: string;
    }>;
    duplicate(req: Request, id: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        status: string;
        leadId: string | null;
        title: string;
        content: string;
    }>;
}
