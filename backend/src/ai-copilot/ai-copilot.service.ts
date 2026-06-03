import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AiService } from '../ai/ai.service';
import { AuditService } from '../audit/audit.service';
import { KnowledgeCategory } from '../knowledge-base/knowledge-base.types';
import { KnowledgeRetrievalService } from '../knowledge-base/knowledge-retrieval.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  AiConversationRecord,
  CopilotAnswer,
  CopilotSourceReference,
} from './ai-copilot.types';
import { CopilotQueryService } from './copilot-query.service';

export const COPILOT_SUGGESTED_QUESTIONS = [
  'What are the top risk sites right now?',
  'What is the revenue forecast?',
  'Show overdue invoices.',
  'Where do we have staffing shortages?',
  'Which contracts or renewals need attention?',
] as const;

type ConversationRow = {
  id: string;
  tenantId: string;
  userId: string | null;
  question: string;
  answer: string;
  confidenceScore: number;
  sourcesUsed: unknown;
  createdAt: Date;
};

@Injectable()
export class AiCopilotService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
    private readonly auditService: AuditService,
    private readonly queryService: CopilotQueryService,
    private readonly knowledgeRetrievalService: KnowledgeRetrievalService,
  ) {}

  async ask(input: {
    tenantId: string;
    userId: string;
    userRole: string;
    question: string;
  }): Promise<CopilotAnswer> {
    const question = input.question.trim();
    const structured = await this.queryService.answerQuestion(
      input.tenantId,
      input.userId,
      question,
    );

    const knowledgeEntries = await this.knowledgeRetrievalService.retrieveRelevant({
      tenantId: input.tenantId,
      userId: input.userId,
      sourceModule: 'ai_copilot.chat',
      query: structured.knowledgeQuery || question,
      categories: this.knowledgeCategoriesForIntent(structured.intent),
      limit: 6,
    });

    const knowledgeSources: CopilotSourceReference[] = knowledgeEntries.map((entry) => ({
      type: 'knowledge',
      id: entry.id,
      title: entry.title,
      url: '/knowledge-base',
      snippet: entry.summary,
    }));

    const aiAnswer = await this.aiService.generateCopilotAnswer(
      JSON.stringify({
        question,
        structuredAnswer: structured.answer,
        structuredContext: structured.context,
        sources: structured.sources,
        organizationalMemory: knowledgeEntries.map((entry) => ({
          title: entry.title,
          category: entry.category,
          summary: entry.summary,
          tags: entry.tags,
        })),
      }),
    );

    const sources = this.dedupeSources([...structured.sources, ...knowledgeSources]);
    const answer = aiAnswer || structured.answer;
    const source: CopilotAnswer['source'] = aiAnswer ? 'ai_assisted' : 'rule_based';
    const confidenceScore = this.roundConfidence(
      Math.min(0.98, structured.confidenceScore + (knowledgeEntries.length > 0 ? 0.03 : 0)),
    );

    const conversation = await this.createConversation({
      tenantId: input.tenantId,
      userId: input.userId,
      question,
      answer,
      confidenceScore,
      sources,
    });

    await Promise.all([
      this.auditService.log({
        tenantId: input.tenantId,
        userId: input.userId,
        action: 'AI_COPILOT_QUESTION_ASKED',
        entityType: 'AiConversation',
        entityId: conversation.id,
        details: question,
      }),
      this.auditService.log({
        tenantId: input.tenantId,
        userId: input.userId,
        action: 'AI_COPILOT_ANSWER_GENERATED',
        entityType: 'AiConversation',
        entityId: conversation.id,
        details: `${source}; ${sources.length} sources used`,
      }),
    ]);

    return {
      conversationId: conversation.id,
      question,
      answer,
      confidenceScore,
      source,
      intent: structured.intent,
      sources,
      actions: structured.actions,
      suggestedQuestions: this.getSuggestedQuestions(input.userRole),
      createdAt: conversation.createdAt.toISOString(),
    };
  }

  async history(tenantId: string, userId: string, limit = 25): Promise<AiConversationRecord[]> {
    const rows = await this.prisma.$queryRaw<ConversationRow[]>(Prisma.sql`
      SELECT
        "id",
        "tenant_id" AS "tenantId",
        "user_id" AS "userId",
        "question",
        "answer",
        "confidence_score" AS "confidenceScore",
        "sources_used" AS "sourcesUsed",
        "created_at" AS "createdAt"
      FROM "AiConversation"
      WHERE "tenant_id" = ${tenantId}
        AND ("user_id" = ${userId} OR "user_id" IS NULL)
      ORDER BY "created_at" DESC
      LIMIT ${Math.max(1, Math.min(limit, 100))}
    `);

    return rows.map((row) => ({
      id: row.id,
      tenantId: row.tenantId,
      userId: row.userId,
      question: row.question,
      answer: row.answer,
      confidenceScore: row.confidenceScore,
      sourcesUsed: Array.isArray(row.sourcesUsed) ? row.sourcesUsed as CopilotSourceReference[] : [],
      createdAt: row.createdAt,
    }));
  }

  getSuggestedQuestions(role?: string) {
    if (role === 'finance') {
      return [
        'What is the revenue forecast?',
        'Show overdue invoices.',
        'Which clients generate the highest revenue?',
        'Which contracts or renewals need attention?',
        'What invoice disputes need attention?',
      ];
    }

    return [...COPILOT_SUGGESTED_QUESTIONS];
  }

  private async createConversation(input: {
    tenantId: string;
    userId: string;
    question: string;
    answer: string;
    confidenceScore: number;
    sources: CopilotSourceReference[];
  }) {
    const rows = await this.prisma.$queryRaw<ConversationRow[]>(Prisma.sql`
      INSERT INTO "AiConversation" (
        "tenant_id",
        "user_id",
        "question",
        "answer",
        "confidence_score",
        "sources_used"
      )
      VALUES (
        ${input.tenantId},
        ${input.userId},
        ${input.question},
        ${input.answer},
        ${input.confidenceScore},
        ${JSON.stringify(input.sources)}::jsonb
      )
      RETURNING
        "id",
        "tenant_id" AS "tenantId",
        "user_id" AS "userId",
        "question",
        "answer",
        "confidence_score" AS "confidenceScore",
        "sources_used" AS "sourcesUsed",
        "created_at" AS "createdAt"
    `);

    return rows[0];
  }

  private knowledgeCategoriesForIntent(intent: string): KnowledgeCategory[] | undefined {
    switch (intent) {
      case 'incidents':
      case 'sites':
        return ['incidents', 'operations'];
      case 'billing':
      case 'revenue':
      case 'clients':
        return ['billing', 'contracts', 'client_management'];
      case 'guards':
      case 'staffing':
        return ['staffing', 'scheduling', 'operations', 'incidents'];
      case 'reports':
        return ['operations', 'incidents', 'billing'];
      default:
        return undefined;
    }
  }

  private dedupeSources(sources: CopilotSourceReference[]) {
    const seen = new Set<string>();
    return sources.filter((source) => {
      const key = `${source.type}:${source.id || source.title}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private roundConfidence(value: number) {
    return Math.round(Math.max(0, Math.min(1, value)) * 100) / 100;
  }
}
