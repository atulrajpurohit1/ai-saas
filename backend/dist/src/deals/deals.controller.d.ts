import { DealsService } from './deals.service';
import { CreateDealDto } from './dto/create-deal.dto';
import { UpdateDealStageDto } from './dto/update-deal-stage.dto';
import { Request } from 'express';
export declare class DealsController {
    private readonly dealsService;
    constructor(dealsService: DealsService);
    create(createDealDto: CreateDealDto, req: Request): Promise<{
        lead: {
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            email: string | null;
            tenantId: string;
            status: string;
            company: string;
        };
    } & {
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        leadId: string;
        clientId: string | null;
        stage: string;
    }>;
    convert(leadId: string, req: Request): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        leadId: string;
        clientId: string | null;
        stage: string;
    }>;
    findAll(req: Request): Promise<({
        salesAssessments: {
            createdAt: Date;
            leadScore: number | null;
            priorityTier: string | null;
            closeReadinessScore: number | null;
            discoveryQualityScore: number | null;
            riskProfile: string | null;
            recommendedNextAction: string | null;
        }[];
        lead: {
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            email: string | null;
            tenantId: string;
            status: string;
            company: string;
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
            billingNotes: string | null;
            internalNotes: string | null;
        } | null;
    } & {
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        leadId: string;
        clientId: string | null;
        stage: string;
    })[]>;
    findOne(id: string, req: Request): Promise<{
        lead: {
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            email: string | null;
            tenantId: string;
            status: string;
            company: string;
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
            billingNotes: string | null;
            internalNotes: string | null;
        } | null;
    } & {
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        leadId: string;
        clientId: string | null;
        stage: string;
    }>;
    updateStage(id: string, updateDealStageDto: UpdateDealStageDto, req: Request): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        leadId: string;
        clientId: string | null;
        stage: string;
    }>;
    remove(id: string, req: Request): Promise<{
        success: boolean;
    }>;
}
