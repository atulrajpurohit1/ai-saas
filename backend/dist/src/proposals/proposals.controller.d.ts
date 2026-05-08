import { ProposalsService } from './proposals.service';
import { CreateProposalDto } from './dto/create-proposal.dto';
import { UpdateProposalDto } from './dto/update-proposal.dto';
import { Request, Response } from 'express';
export declare class ProposalsController {
    private readonly proposalsService;
    constructor(proposalsService: ProposalsService);
    create(req: Request, createProposalDto: CreateProposalDto): Promise<{
        id: string;
        title: string;
        content: string;
        status: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        dealId: string | null;
        leadId: string | null;
        clientId: string | null;
    }>;
    findAll(req: Request): Promise<({
        lead: {
            id: string;
            status: string;
            createdAt: Date;
            updatedAt: Date;
            tenantId: string;
            name: string;
            company: string;
            email: string | null;
        } | null;
        deal: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            tenantId: string;
            leadId: string;
            clientId: string | null;
            name: string;
            stage: string;
        } | null;
        client: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            tenantId: string;
            name: string;
            email: string;
            companyName: string | null;
            phone: string | null;
        } | null;
        _count: {
            versions: number;
        };
    } & {
        id: string;
        title: string;
        content: string;
        status: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        dealId: string | null;
        leadId: string | null;
        clientId: string | null;
    })[]>;
    generateProposal(req: Request, leadId: string, clientId?: string): Promise<{
        id: string;
        title: string;
        content: string;
        status: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        dealId: string | null;
        leadId: string | null;
        clientId: string | null;
    }>;
    generateBulkProposals(req: Request): Promise<{
        generatedCount: number;
        totalProcessed: number;
    }>;
    findOne(req: Request, id: string): Promise<{
        lead: {
            id: string;
            status: string;
            createdAt: Date;
            updatedAt: Date;
            tenantId: string;
            name: string;
            company: string;
            email: string | null;
        } | null;
        deal: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            tenantId: string;
            leadId: string;
            clientId: string | null;
            name: string;
            stage: string;
        } | null;
        versions: {
            id: string;
            content: string;
            createdAt: Date;
            versionNumber: number;
            proposalId: string;
        }[];
        client: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            tenantId: string;
            name: string;
            email: string;
            companyName: string | null;
            phone: string | null;
        } | null;
    } & {
        id: string;
        title: string;
        content: string;
        status: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        dealId: string | null;
        leadId: string | null;
        clientId: string | null;
    }>;
    update(req: Request, id: string, updateProposalDto: UpdateProposalDto): Promise<{
        id: string;
        title: string;
        content: string;
        status: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        dealId: string | null;
        leadId: string | null;
        clientId: string | null;
    }>;
    export(req: Request, id: string, res: Response): Promise<void>;
    getComments(req: Request, id: string): Promise<{
        id: string;
        content: string;
        createdAt: Date;
        tenantId: string;
        proposalId: string;
        userId: string | null;
        clientUserId: string | null;
    }[]>;
    addComment(req: Request, id: string, content: string): Promise<{
        id: string;
        content: string;
        createdAt: Date;
        tenantId: string;
        proposalId: string;
        userId: string | null;
        clientUserId: string | null;
    }>;
    share(req: Request, id: string, clientId: string): Promise<{
        id: string;
        title: string;
        content: string;
        status: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        dealId: string | null;
        leadId: string | null;
        clientId: string | null;
    }>;
}
