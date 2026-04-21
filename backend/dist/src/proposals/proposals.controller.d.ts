import { ProposalsService } from './proposals.service';
import { CreateProposalDto } from './dto/create-proposal.dto';
import { UpdateProposalDto } from './dto/update-proposal.dto';
import { Request } from 'express';
export declare class ProposalsController {
    private readonly proposalsService;
    constructor(proposalsService: ProposalsService);
    create(req: Request, createProposalDto: CreateProposalDto): Promise<{
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
    findAll(req: Request): Promise<({
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
    generateProposal(req: Request, leadId: string): Promise<{
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
    generateBulkProposals(req: Request): Promise<{
        generatedCount: number;
        totalProcessed: number;
    }>;
    findOne(req: Request, id: string): Promise<{
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
    update(req: Request, id: string, updateProposalDto: UpdateProposalDto): Promise<{
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
    duplicate(req: Request, id: string): Promise<{
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
}
