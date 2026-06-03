import { ProposalsService } from './proposals.service';
import { CreateProposalDto } from './dto/create-proposal.dto';
import { UpdateProposalDto } from './dto/update-proposal.dto';
import { Request, Response } from 'express';
export declare class ProposalsController {
    private readonly proposalsService;
    constructor(proposalsService: ProposalsService);
    create(req: Request, createProposalDto: CreateProposalDto): Promise<{
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
    findAll(req: Request): Promise<({
        _count: {
            versions: number;
        };
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
        } | null;
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
            clientId: string | null;
            leadId: string;
            stage: string;
        } | null;
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
    })[]>;
    generateProposal(req: Request, leadId: string, clientId?: string): Promise<{
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
    generateBulkProposals(req: Request): Promise<{
        generatedCount: number;
        totalProcessed: number;
    }>;
    findOne(req: Request, id: string): Promise<{
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
        } | null;
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
            clientId: string | null;
            leadId: string;
            stage: string;
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
    update(req: Request, id: string, updateProposalDto: UpdateProposalDto): Promise<{
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
    export(req: Request, id: string, res: Response): Promise<void>;
    getComments(req: Request, id: string): Promise<{
        id: string;
        createdAt: Date;
        tenantId: string;
        content: string;
        proposalId: string;
        userId: string | null;
        clientUserId: string | null;
    }[]>;
    addComment(req: Request, id: string, content: string): Promise<{
        id: string;
        createdAt: Date;
        tenantId: string;
        content: string;
        proposalId: string;
        userId: string | null;
        clientUserId: string | null;
    }>;
    share(req: Request, id: string, clientId: string): Promise<{
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
}
