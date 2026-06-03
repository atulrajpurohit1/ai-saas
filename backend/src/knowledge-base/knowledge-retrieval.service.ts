import { Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { KnowledgeCategory, KnowledgeRetrievalResult } from './knowledge-base.types';
import { KnowledgeBaseService } from './knowledge-base.service';

@Injectable()
export class KnowledgeRetrievalService {
  constructor(
    private readonly knowledgeBaseService: KnowledgeBaseService,
    private readonly auditService: AuditService,
  ) {}

  async retrieveRelevant(input: {
    tenantId: string;
    query: string;
    categories?: KnowledgeCategory[];
    tags?: string[];
    sourceModule: string;
    userId?: string;
    limit?: number;
    excludeSourceId?: string;
  }): Promise<KnowledgeRetrievalResult[]> {
    const entries = await this.knowledgeBaseService.findRelevantEntries({
      tenantId: input.tenantId,
      query: input.query,
      categories: input.categories,
      tags: input.tags,
      limit: input.limit,
      excludeSourceId: input.excludeSourceId,
    });

    await this.auditService.log({
      tenantId: input.tenantId,
      userId: input.userId,
      action: 'AI_RETRIEVAL_EXECUTED',
      entityType: 'KnowledgeEntry',
      details: `${input.sourceModule} retrieved ${entries.length} knowledge entries`,
    });

    return entries.map((entry) => ({
      id: entry.id,
      title: entry.title,
      category: entry.category,
      sourceType: entry.sourceType,
      sourceId: entry.sourceId,
      summary: entry.summary,
      detailedContent: entry.detailedContent,
      keywords: entry.keywords,
      tags: entry.tags,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
      relevanceScore: entry.relevanceScore,
    }));
  }

  formatForPrompt(entries: KnowledgeRetrievalResult[]) {
    if (entries.length === 0) {
      return 'No relevant organizational knowledge entries were found.';
    }

    return entries
      .map((entry, index) => [
        `${index + 1}. ${entry.title}`,
        `Category: ${entry.category}`,
        `Source: ${entry.sourceType || 'manual'}${entry.sourceId ? `/${entry.sourceId}` : ''}`,
        `Summary: ${entry.summary}`,
        `Tags: ${entry.tags.join(', ') || 'none'}`,
      ].join('\n'))
      .join('\n\n');
  }
}
