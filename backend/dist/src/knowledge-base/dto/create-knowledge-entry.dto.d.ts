import { KnowledgeCategory } from '../knowledge-base.types';
export declare class CreateKnowledgeEntryDto {
    title: string;
    category: KnowledgeCategory;
    sourceType?: string;
    sourceId?: string;
    summary: string;
    detailedContent: string;
    keywords?: string[];
    tags?: string[];
}
