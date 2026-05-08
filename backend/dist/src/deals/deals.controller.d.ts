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
            company: string;
            status: string;
        };
    } & {
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        stage: string;
        leadId: string;
        clientId: string | null;
    }>;
    convert(leadId: string, req: Request): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        stage: string;
        leadId: string;
        clientId: string | null;
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
            leadId: string | null;
            content: string;
            dealId: string | null;
        }[];
        lead: {
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            email: string | null;
            tenantId: string;
            company: string;
            status: string;
        };
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
        name: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        stage: string;
        leadId: string;
        clientId: string | null;
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
            leadId: string | null;
            content: string;
            dealId: string | null;
        }[];
        lead: {
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            email: string | null;
            tenantId: string;
            company: string;
            status: string;
        };
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
        name: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        stage: string;
        leadId: string;
        clientId: string | null;
    }>;
    updateStage(id: string, updateDealStageDto: UpdateDealStageDto, req: Request): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        stage: string;
        leadId: string;
        clientId: string | null;
    }>;
    remove(id: string, req: Request): Promise<{
        success: boolean;
    }>;
}
