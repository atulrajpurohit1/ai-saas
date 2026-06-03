import { AuditService } from '../audit/audit.service';
import { KnowledgeCategory, KnowledgeRetrievalResult } from './knowledge-base.types';
import { KnowledgeBaseService } from './knowledge-base.service';
export declare class KnowledgeRetrievalService {
    private readonly knowledgeBaseService;
    private readonly auditService;
    constructor(knowledgeBaseService: KnowledgeBaseService, auditService: AuditService);
    retrieveRelevant(input: {
        tenantId: string;
        query: string;
        categories?: KnowledgeCategory[];
        tags?: string[];
        sourceModule: string;
        userId?: string;
        limit?: number;
        excludeSourceId?: string;
    }): Promise<KnowledgeRetrievalResult[]>;
    formatForPrompt(entries: KnowledgeRetrievalResult[]): string;
}
