import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
type ImportTarget = 'leads' | 'deals';
type ImportField = 'name' | 'company' | 'email' | 'status' | 'dealName' | 'stage' | 'propertyType' | 'buyerRole' | 'currentProvider' | 'guardCount' | 'serviceHours' | 'painPoints' | 'riskConcerns' | 'decisionTimeline' | 'budgetSensitivity' | 'objections' | 'notes';
type ImportMapping = Partial<Record<ImportField, string>>;
type CsvRow = Record<string, string | undefined>;
export declare class SalesImportsService {
    private readonly prisma;
    private readonly auditService;
    constructor(prisma: PrismaService, auditService: AuditService);
    preview(buffer: Buffer): Promise<{
        headers: string[];
        sampleRows: CsvRow[];
        previewRows: number;
        totalRows: number;
        detectedMapping: Partial<Record<ImportField, string>>;
        requiredFields: {
            leads: string[];
            deals: string[];
        };
    }>;
    commit(buffer: Buffer, body: {
        target?: string;
        mapping?: string | ImportMapping;
    }, tenantId: string, userId?: string): Promise<{
        target: ImportTarget;
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
        errors: Array<{
            row: number;
            message: string;
        }>;
    }>;
    private syncLead;
    private syncDeal;
    private createDiscoverySession;
    private parseCsv;
    private detectMapping;
    private normalizeMapping;
    private validateMapping;
    private normalizeTarget;
    private normalizeStage;
    private text;
    private number;
    private list;
    private normalizeHeader;
}
export {};
