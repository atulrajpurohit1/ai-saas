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
exports.KnowledgeRetrievalService = void 0;
const common_1 = require("@nestjs/common");
const audit_service_1 = require("../audit/audit.service");
const knowledge_base_service_1 = require("./knowledge-base.service");
let KnowledgeRetrievalService = class KnowledgeRetrievalService {
    knowledgeBaseService;
    auditService;
    constructor(knowledgeBaseService, auditService) {
        this.knowledgeBaseService = knowledgeBaseService;
        this.auditService = auditService;
    }
    async retrieveRelevant(input) {
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
    formatForPrompt(entries) {
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
};
exports.KnowledgeRetrievalService = KnowledgeRetrievalService;
exports.KnowledgeRetrievalService = KnowledgeRetrievalService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [knowledge_base_service_1.KnowledgeBaseService,
        audit_service_1.AuditService])
], KnowledgeRetrievalService);
//# sourceMappingURL=knowledge-retrieval.service.js.map