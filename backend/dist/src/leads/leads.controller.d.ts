import { Response } from 'express';
import { LeadsService } from './leads.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { UpdateLeadStatusDto } from './dto/update-lead-status.dto';
import { ImportLeadsDto } from './dto/import-leads.dto';
import { CrmImportService } from './import/crm-import.service';
import { Request } from 'express';
export declare class LeadsController {
    private readonly leadsService;
    private readonly crmImportService;
    constructor(leadsService: LeadsService, crmImportService: CrmImportService);
    create(createLeadDto: CreateLeadDto, req: Request): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        email: string | null;
        tenantId: string;
        status: string;
        company: string;
    }>;
    findAll(req: Request): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        salesAssessments: {
            createdAt: Date;
            leadScore: number | null;
            priorityTier: string | null;
            closeReadinessScore: number | null;
            discoveryQualityScore: number | null;
            recommendedNextAction: string | null;
        }[];
        email: string | null;
        status: string;
        company: string;
    }[]>;
    import(file: Express.Multer.File, req: Request): Promise<{
        count: number;
    }>;
    importFields(): {
        fields: readonly ["name", "company", "email", "status"];
        required: ("name" | "email" | "status" | "company")[];
    };
    previewImport(file: Express.Multer.File): Promise<import("./import/crm-import.types").ImportPreview>;
    commitImport(file: Express.Multer.File, dto: ImportLeadsDto, req: Request): Promise<import("./import/crm-import.types").ImportResult>;
    uploadPdf(file: Express.Multer.File, req: Request): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        email: string | null;
        tenantId: string;
        status: string;
        company: string;
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
        status: string;
        company: string;
    }>;
    update(id: string, updateLeadDto: UpdateLeadDto, req: Request): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        email: string | null;
        tenantId: string;
        status: string;
        company: string;
    }>;
    updateStatus(id: string, updateLeadStatusDto: UpdateLeadStatusDto, req: Request): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        email: string | null;
        tenantId: string;
        status: string;
        company: string;
    }>;
    remove(id: string, req: Request): Promise<{
        success: boolean;
    }>;
}
