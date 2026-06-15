import { Request } from 'express';
import { SalesImportsService } from './sales-imports.service';
export declare class SalesImportsController {
    private readonly salesImportsService;
    constructor(salesImportsService: SalesImportsService);
    preview(file: Express.Multer.File): Promise<{
        headers: string[];
        sampleRows: {
            [x: string]: string | undefined;
        }[];
        previewRows: number;
        totalRows: number;
        detectedMapping: Partial<Record<"name" | "notes" | "email" | "status" | "company" | "guardCount" | "objections" | "propertyType" | "buyerRole" | "currentProvider" | "serviceHours" | "painPoints" | "riskConcerns" | "decisionTimeline" | "budgetSensitivity" | "stage" | "dealName", string>>;
        requiredFields: {
            leads: string[];
            deals: string[];
        };
    }>;
    commit(file: Express.Multer.File, body: {
        target?: string;
        mapping?: string;
    }, req: Request): Promise<{
        target: "deals" | "leads";
        totalRows: number;
        processedRows: number;
        skippedRows: number;
        leadsCreated: number;
        leadsUpdated: number;
        leadsMatched: number;
        dealsCreated: number;
        dealsUpdated: number;
        dealsMatched: number;
        discoverySessionsCreated: number;
        errors: {
            row: number;
            message: string;
        }[];
    }>;
}
