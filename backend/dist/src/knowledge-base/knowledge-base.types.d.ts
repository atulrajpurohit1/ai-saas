export declare const KNOWLEDGE_CATEGORIES: readonly ["incidents", "operations", "staffing", "contracts", "billing", "client_management", "scheduling"];
export type KnowledgeCategory = (typeof KNOWLEDGE_CATEGORIES)[number];
export type KnowledgeSourceType = 'incident' | 'invoice_dispute' | 'daily_report' | 'ai_action' | 'contract_resolution' | 'manual';
export type KnowledgeRetrievalResult = {
    id: string;
    title: string;
    category: string;
    sourceType: string | null;
    sourceId: string | null;
    summary: string;
    detailedContent: string;
    keywords: string[];
    tags: string[];
    createdAt: Date;
    updatedAt: Date;
    relevanceScore: number;
};
