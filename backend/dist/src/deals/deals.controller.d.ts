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
        clientId: string | null;
        leadId: string;
        stage: string;
    }>;
    convert(leadId: string, req: Request): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        clientId: string | null;
        leadId: string;
        stage: string;
    }>;
    findAll(req: Request): Promise<({
        activities: {
            id: string;
            createdAt: Date;
            tenantId: string;
            status: string;
            dealId: string | null;
            subject: string;
            type: string;
            description: string | null;
            dueDate: Date | null;
        }[];
        notes: {
            id: string;
            createdAt: Date;
            tenantId: string;
            content: string;
            dealId: string | null;
            leadId: string | null;
        }[];
        client: {
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            email: string;
            tenantId: string;
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
        };
    } & {
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        clientId: string | null;
        leadId: string;
        stage: string;
    })[]>;
    findOne(id: string, req: Request): Promise<{
        activities: {
            id: string;
            createdAt: Date;
            tenantId: string;
            status: string;
            dealId: string | null;
            subject: string;
            type: string;
            description: string | null;
            dueDate: Date | null;
        }[];
        notes: {
            id: string;
            createdAt: Date;
            tenantId: string;
            content: string;
            dealId: string | null;
            leadId: string | null;
        }[];
        client: {
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            email: string;
            tenantId: string;
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
        };
    } & {
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        clientId: string | null;
        leadId: string;
        stage: string;
    }>;
    updateStage(id: string, updateDealStageDto: UpdateDealStageDto, req: Request): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        clientId: string | null;
        leadId: string;
        stage: string;
    }>;
    remove(id: string, req: Request): Promise<{
        success: boolean;
    }>;
}
