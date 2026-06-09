import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateKnowledgeEntryDto } from './dto/create-knowledge-entry.dto';
import { UpdateKnowledgeEntryDto } from './dto/update-knowledge-entry.dto';
import { KnowledgeCategory, KnowledgeSourceType } from './knowledge-base.types';
export declare class KnowledgeBaseService {
    private readonly prisma;
    private readonly auditService;
    constructor(prisma: PrismaService, auditService: AuditService);
    createManual(tenantId: string, userId: string, dto: CreateKnowledgeEntryDto): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        title: string;
        summary: string;
        createdBy: string | null;
        category: string;
        sourceType: string | null;
        sourceId: string | null;
        detailedContent: string;
        keywords: string[];
        tags: string[];
        archivedAt: Date | null;
    }>;
    createEntry(tenantId: string, userId: string | undefined, input: CreateKnowledgeEntryDto): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        title: string;
        summary: string;
        createdBy: string | null;
        category: string;
        sourceType: string | null;
        sourceId: string | null;
        detailedContent: string;
        keywords: string[];
        tags: string[];
        archivedAt: Date | null;
    }>;
    createFromIncident(tenantId: string, userId: string, incident: {
        id: string;
        title: string;
        description: string;
        severity: string;
        status: string;
        reviewNote: string | null;
        notes: string | null;
        occurredAt: Date;
        site: {
            name: string;
            address?: string | null;
        };
        guard: {
            name: string;
        };
    }): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        title: string;
        summary: string;
        createdBy: string | null;
        category: string;
        sourceType: string | null;
        sourceId: string | null;
        detailedContent: string;
        keywords: string[];
        tags: string[];
        archivedAt: Date | null;
    } | null>;
    createFromDispute(tenantId: string, userId: string, dispute: {
        id: string;
        reason: string;
        description: string;
        adminResponse: string | null;
        client: {
            name: string;
            companyName: string | null;
        } | null;
        invoice: {
            invoiceNumber: string;
            totalAmount: number;
            site?: {
                name: string;
            } | null;
        } | null;
    }): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        title: string;
        summary: string;
        createdBy: string | null;
        category: string;
        sourceType: string | null;
        sourceId: string | null;
        detailedContent: string;
        keywords: string[];
        tags: string[];
        archivedAt: Date | null;
    }>;
    createFromReport(tenantId: string, userId: string, report: {
        id: string;
        reportDate: Date;
        summary: string;
        client: {
            name: string;
            companyName: string | null;
        };
        site: {
            name: string;
        };
    }): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        title: string;
        summary: string;
        createdBy: string | null;
        category: string;
        sourceType: string | null;
        sourceId: string | null;
        detailedContent: string;
        keywords: string[];
        tags: string[];
        archivedAt: Date | null;
    }>;
    createFromAiAction(tenantId: string, userId: string, action: {
        id: string;
        title: string;
        description: string;
        actionType: string;
        targetModule: string;
        targetEntityId: string | null;
    }): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        title: string;
        summary: string;
        createdBy: string | null;
        category: string;
        sourceType: string | null;
        sourceId: string | null;
        detailedContent: string;
        keywords: string[];
        tags: string[];
        archivedAt: Date | null;
    }>;
    findAll(tenantId: string, userId: string, filters: {
        category?: string;
        tag?: string;
        includeArchived?: string;
    }): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        title: string;
        summary: string;
        createdBy: string | null;
        category: string;
        sourceType: string | null;
        sourceId: string | null;
        detailedContent: string;
        keywords: string[];
        tags: string[];
        archivedAt: Date | null;
    }[]>;
    findOne(tenantId: string, userId: string, id: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        title: string;
        summary: string;
        createdBy: string | null;
        category: string;
        sourceType: string | null;
        sourceId: string | null;
        detailedContent: string;
        keywords: string[];
        tags: string[];
        archivedAt: Date | null;
    }>;
    search(tenantId: string, userId: string, filters: {
        q?: string;
        category?: string;
        tag?: string;
    }): Promise<{
        relevanceScore: number;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        title: string;
        summary: string;
        createdBy: string | null;
        category: string;
        sourceType: string | null;
        sourceId: string | null;
        detailedContent: string;
        keywords: string[];
        tags: string[];
        archivedAt: Date | null;
    }[]>;
    update(tenantId: string, userId: string, id: string, dto: UpdateKnowledgeEntryDto): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        title: string;
        summary: string;
        createdBy: string | null;
        category: string;
        sourceType: string | null;
        sourceId: string | null;
        detailedContent: string;
        keywords: string[];
        tags: string[];
        archivedAt: Date | null;
    }>;
    archive(tenantId: string, userId: string, id: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        title: string;
        summary: string;
        createdBy: string | null;
        category: string;
        sourceType: string | null;
        sourceId: string | null;
        detailedContent: string;
        keywords: string[];
        tags: string[];
        archivedAt: Date | null;
    }>;
    findRelevantEntries(input: {
        tenantId: string;
        query: string;
        categories?: KnowledgeCategory[];
        tags?: string[];
        sourceType?: KnowledgeSourceType | string;
        excludeSourceId?: string;
        limit?: number;
    }): Promise<{
        relevanceScore: number;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        title: string;
        summary: string;
        createdBy: string | null;
        category: string;
        sourceType: string | null;
        sourceId: string | null;
        detailedContent: string;
        keywords: string[];
        tags: string[];
        archivedAt: Date | null;
    }[]>;
    private normalizeEntryInput;
    private normalizePartialInput;
    private requiredText;
    private requireCategory;
    private optionalCategory;
    private cleanList;
    extractKeywords(text: string): string[];
    private scoreEntry;
    private safeSummaryText;
    private categoryForAction;
}
