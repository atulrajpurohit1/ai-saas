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
        clientId: string | null;
        leadId: string | null;
        content: string;
        dealId: string | null;
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
    generateProposal(req: Request, leadId: string, clientId?: string): Promise<{
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
    update(req: Request, id: string, updateProposalDto: UpdateProposalDto): Promise<{
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
        clientId: string | null;
        leadId: string | null;
        content: string;
        dealId: string | null;
    }>;
}
