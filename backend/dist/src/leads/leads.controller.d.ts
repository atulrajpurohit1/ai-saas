import { Response } from 'express';
import { LeadsService } from './leads.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { UpdateLeadStatusDto } from './dto/update-lead-status.dto';
import { Request } from 'express';
export declare class LeadsController {
    private readonly leadsService;
    constructor(leadsService: LeadsService);
    create(createLeadDto: CreateLeadDto, req: Request): Promise<{
        name: string;
        id: string;
        company: string;
        status: string;
        tenantId: string;
        createdAt: Date;
        updatedAt: Date;
        email: string | null;
    }>;
    findAll(req: Request): Promise<({
        deals: {
            name: string;
            id: string;
            tenantId: string;
            createdAt: Date;
            updatedAt: Date;
            leadId: string;
            stage: string;
        }[];
        notes: {
            id: string;
            tenantId: string;
            createdAt: Date;
            content: string;
            dealId: string | null;
            leadId: string | null;
        }[];
    } & {
        name: string;
        id: string;
        company: string;
        status: string;
        tenantId: string;
        createdAt: Date;
        updatedAt: Date;
        email: string | null;
    })[]>;
    import(file: Express.Multer.File, req: Request): Promise<{
        count: number;
    }>;
    uploadPdf(file: Express.Multer.File, req: Request): Promise<{
        name: string;
        id: string;
        company: string;
        status: string;
        tenantId: string;
        createdAt: Date;
        updatedAt: Date;
        email: string | null;
    }>;
    analyzePdf(file: Express.Multer.File): Promise<{
        name: string;
        company: string;
        email: string;
    }>;
    export(res: Response, req: Request): Promise<void>;
    findOne(id: string, req: Request): Promise<{
        deals: {
            name: string;
            id: string;
            tenantId: string;
            createdAt: Date;
            updatedAt: Date;
            leadId: string;
            stage: string;
        }[];
        notes: {
            id: string;
            tenantId: string;
            createdAt: Date;
            content: string;
            dealId: string | null;
            leadId: string | null;
        }[];
    } & {
        name: string;
        id: string;
        company: string;
        status: string;
        tenantId: string;
        createdAt: Date;
        updatedAt: Date;
        email: string | null;
    }>;
    update(id: string, updateLeadDto: UpdateLeadDto, req: Request): Promise<{
        name: string;
        id: string;
        company: string;
        status: string;
        tenantId: string;
        createdAt: Date;
        updatedAt: Date;
        email: string | null;
    }>;
    updateStatus(id: string, updateLeadStatusDto: UpdateLeadStatusDto, req: Request): Promise<{
        name: string;
        id: string;
        company: string;
        status: string;
        tenantId: string;
        createdAt: Date;
        updatedAt: Date;
        email: string | null;
    }>;
    remove(id: string, req: Request): Promise<{
        success: boolean;
    }>;
}
