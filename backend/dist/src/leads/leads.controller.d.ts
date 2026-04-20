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
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        email: string | null;
        tenantId: string;
        company: string;
        status: string;
    }>;
    findAll(req: Request): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        email: string | null;
        tenantId: string;
        company: string;
        status: string;
    }[]>;
    import(file: Express.Multer.File, req: Request): Promise<{
        count: number;
    }>;
    uploadPdf(file: Express.Multer.File, req: Request): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        email: string | null;
        tenantId: string;
        company: string;
        status: string;
    }>;
    analyzePdf(file: Express.Multer.File): Promise<{
        name: string;
        company: string;
        email: string;
    }>;
    export(res: Response, req: Request): Promise<void>;
    findOne(id: string, req: Request): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        email: string | null;
        tenantId: string;
        company: string;
        status: string;
    }>;
    update(id: string, updateLeadDto: UpdateLeadDto, req: Request): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        email: string | null;
        tenantId: string;
        company: string;
        status: string;
    }>;
    updateStatus(id: string, updateLeadStatusDto: UpdateLeadStatusDto, req: Request): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        email: string | null;
        tenantId: string;
        company: string;
        status: string;
    }>;
    remove(id: string, req: Request): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        email: string | null;
        tenantId: string;
        company: string;
        status: string;
    }>;
}
