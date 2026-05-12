import { ProposalsService } from './proposals.service';
import { CreateProposalDto } from './dto/create-proposal.dto';
import { UpdateProposalDto } from './dto/update-proposal.dto';
import { Request, Response } from 'express';
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
        clientId: string | null;
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
            clientId: string | null;
            stage: string;
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
        clientId: string | null;
    })[]>;
    generateProposal(req: Request, leadId: string, clientId?: string): Promise<{
        id: string;
        status: string;
        tenantId: string;
        createdAt: Date;
        updatedAt: Date;
        title: string;
        content: string;
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
            clientId: string | null;
            stage: string;
        } | null;
        versions: {
            id: string;
            createdAt: Date;
            content: string;
            versionNumber: number;
            proposalId: string;
        }[];
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
        clientId: string | null;
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
        clientId: string | null;
    }>;
    export(req: Request, id: string, res: Response): Promise<void>;
    getComments(req: Request, id: string): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        userId: string | null;
        content: string;
        proposalId: string;
        clientUserId: string | null;
    }[]>;
    addComment(req: Request, id: string, content: string): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        userId: string | null;
        content: string;
        proposalId: string;
        clientUserId: string | null;
    }>;
    share(req: Request, id: string, clientId: string): Promise<{
        id: string;
        status: string;
        tenantId: string;
        createdAt: Date;
        updatedAt: Date;
        title: string;
        content: string;
        dealId: string | null;
        leadId: string | null;
        clientId: string | null;
    }>;
}
