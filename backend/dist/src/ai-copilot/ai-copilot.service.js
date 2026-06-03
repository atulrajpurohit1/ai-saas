"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiCopilotService = exports.COPILOT_SUGGESTED_QUESTIONS = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const ai_service_1 = require("../ai/ai.service");
const audit_service_1 = require("../audit/audit.service");
const knowledge_retrieval_service_1 = require("../knowledge-base/knowledge-retrieval.service");
const prisma_service_1 = require("../prisma/prisma.service");
const copilot_query_service_1 = require("./copilot-query.service");
exports.COPILOT_SUGGESTED_QUESTIONS = [
    'What are the top risk sites right now?',
    'What is the revenue forecast?',
    'Show overdue invoices.',
    'Where do we have staffing shortages?',
    'Which contracts or renewals need attention?',
];
let AiCopilotService = class AiCopilotService {
    prisma;
    aiService;
    auditService;
    queryService;
    knowledgeRetrievalService;
    constructor(prisma, aiService, auditService, queryService, knowledgeRetrievalService) {
        this.prisma = prisma;
        this.aiService = aiService;
        this.auditService = auditService;
        this.queryService = queryService;
        this.knowledgeRetrievalService = knowledgeRetrievalService;
    }
    async ask(input) {
        const question = input.question.trim();
        const structured = await this.queryService.answerQuestion(input.tenantId, input.userId, question);
        const knowledgeEntries = await this.knowledgeRetrievalService.retrieveRelevant({
            tenantId: input.tenantId,
            userId: input.userId,
            sourceModule: 'ai_copilot.chat',
            query: structured.knowledgeQuery || question,
            categories: this.knowledgeCategoriesForIntent(structured.intent),
            limit: 6,
        });
        const knowledgeSources = knowledgeEntries.map((entry) => ({
            type: 'knowledge',
            id: entry.id,
            title: entry.title,
            url: '/knowledge-base',
            snippet: entry.summary,
        }));
        const aiAnswer = await this.aiService.generateCopilotAnswer(JSON.stringify({
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
        }));
        const sources = this.dedupeSources([...structured.sources, ...knowledgeSources]);
        const answer = aiAnswer || structured.answer;
        const source = aiAnswer ? 'ai_assisted' : 'rule_based';
        const confidenceScore = this.roundConfidence(Math.min(0.98, structured.confidenceScore + (knowledgeEntries.length > 0 ? 0.03 : 0)));
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
    async history(tenantId, userId, limit = 25) {
        const rows = await this.prisma.$queryRaw(client_1.Prisma.sql `
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
            sourcesUsed: Array.isArray(row.sourcesUsed) ? row.sourcesUsed : [],
            createdAt: row.createdAt,
        }));
    }
    getSuggestedQuestions(role) {
        if (role === 'finance') {
            return [
                'What is the revenue forecast?',
                'Show overdue invoices.',
                'Which clients generate the highest revenue?',
                'Which contracts or renewals need attention?',
                'What invoice disputes need attention?',
            ];
        }
        return [...exports.COPILOT_SUGGESTED_QUESTIONS];
    }
    async createConversation(input) {
        const rows = await this.prisma.$queryRaw(client_1.Prisma.sql `
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
    knowledgeCategoriesForIntent(intent) {
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
    dedupeSources(sources) {
        const seen = new Set();
        return sources.filter((source) => {
            const key = `${source.type}:${source.id || source.title}`;
            if (seen.has(key))
                return false;
            seen.add(key);
            return true;
        });
    }
    roundConfidence(value) {
        return Math.round(Math.max(0, Math.min(1, value)) * 100) / 100;
    }
};
exports.AiCopilotService = AiCopilotService;
exports.AiCopilotService = AiCopilotService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        ai_service_1.AiService,
        audit_service_1.AuditService,
        copilot_query_service_1.CopilotQueryService,
        knowledge_retrieval_service_1.KnowledgeRetrievalService])
], AiCopilotService);
//# sourceMappingURL=ai-copilot.service.js.map