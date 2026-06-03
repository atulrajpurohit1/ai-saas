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
exports.KnowledgeBaseService = void 0;
const common_1 = require("@nestjs/common");
const audit_service_1 = require("../audit/audit.service");
const prisma_service_1 = require("../prisma/prisma.service");
const knowledge_base_types_1 = require("./knowledge-base.types");
let KnowledgeBaseService = class KnowledgeBaseService {
    prisma;
    auditService;
    constructor(prisma, auditService) {
        this.prisma = prisma;
        this.auditService = auditService;
    }
    async createManual(tenantId, userId, dto) {
        const entry = await this.createEntry(tenantId, userId, {
            ...dto,
            sourceType: dto.sourceType || 'manual',
        });
        await this.auditService.log({
            tenantId,
            userId,
            action: 'KNOWLEDGE_CREATED',
            entityType: 'KnowledgeEntry',
            entityId: entry.id,
            details: `Knowledge entry "${entry.title}" created manually`,
        });
        return entry;
    }
    async createEntry(tenantId, userId, input) {
        const data = this.normalizeEntryInput(input);
        const existing = data.sourceType && data.sourceId
            ? await this.prisma.knowledgeEntry.findFirst({
                where: {
                    tenantId,
                    sourceType: data.sourceType,
                    sourceId: data.sourceId,
                },
            })
            : null;
        if (existing) {
            const updated = await this.prisma.knowledgeEntry.update({
                where: { id: existing.id },
                data: {
                    ...data,
                    createdBy: existing.createdBy ?? userId ?? null,
                    archivedAt: null,
                },
            });
            await this.auditService.log({
                tenantId,
                userId,
                action: 'KNOWLEDGE_UPDATED',
                entityType: 'KnowledgeEntry',
                entityId: updated.id,
                details: `Knowledge refreshed from ${data.sourceType}/${data.sourceId}`,
            });
            return updated;
        }
        const created = await this.prisma.knowledgeEntry.create({
            data: {
                tenantId,
                ...data,
                createdBy: userId ?? null,
            },
        });
        await this.auditService.log({
            tenantId,
            userId,
            action: 'KNOWLEDGE_CREATED',
            entityType: 'KnowledgeEntry',
            entityId: created.id,
            details: `Knowledge created from ${created.sourceType || 'manual'}${created.sourceId ? `/${created.sourceId}` : ''}`,
        });
        return created;
    }
    async createFromIncident(tenantId, userId, incident) {
        if (incident.status !== 'approved')
            return null;
        return this.createEntry(tenantId, userId, {
            title: `Incident resolution: ${incident.title}`,
            category: 'incidents',
            sourceType: 'incident',
            sourceId: incident.id,
            summary: [
                `${incident.severity.toUpperCase()} incident at ${incident.site.name}.`,
                incident.reviewNote ? `Resolution: ${incident.reviewNote}` : 'Approved without a detailed resolution note.',
            ].join(' '),
            detailedContent: [
                `Incident: ${incident.title}`,
                `Site: ${incident.site.name}${incident.site.address ? `, ${incident.site.address}` : ''}`,
                `Guard: ${incident.guard.name}`,
                `Occurred: ${incident.occurredAt.toISOString()}`,
                `Severity: ${incident.severity}`,
                '',
                'Description:',
                incident.description,
                '',
                'Resolution:',
                incident.reviewNote || 'Approved without a detailed resolution note.',
                incident.notes ? ['', 'Guard notes:', incident.notes].join('\n') : '',
            ].filter(Boolean).join('\n'),
            keywords: this.extractKeywords(`${incident.title} ${incident.description} ${incident.reviewNote || ''}`),
            tags: ['incident', incident.severity, incident.site.name],
        });
    }
    async createFromDispute(tenantId, userId, dispute) {
        const clientName = dispute.client?.companyName || dispute.client?.name || 'Client';
        const invoiceNumber = dispute.invoice?.invoiceNumber || 'invoice';
        return this.createEntry(tenantId, userId, {
            title: `Billing dispute resolved: ${invoiceNumber}`,
            category: 'billing',
            sourceType: 'invoice_dispute',
            sourceId: dispute.id,
            summary: `${clientName} dispute for ${invoiceNumber} was resolved. ${dispute.adminResponse || dispute.reason}`,
            detailedContent: [
                `Client: ${clientName}`,
                `Invoice: ${invoiceNumber}`,
                dispute.invoice?.site?.name ? `Site: ${dispute.invoice.site.name}` : null,
                dispute.invoice ? `Amount: ${dispute.invoice.totalAmount}` : null,
                `Reason: ${dispute.reason}`,
                '',
                'Description:',
                dispute.description,
                '',
                'Resolution:',
                dispute.adminResponse || 'Resolved without an additional admin response.',
            ].filter(Boolean).join('\n'),
            keywords: this.extractKeywords(`${dispute.reason} ${dispute.description} ${dispute.adminResponse || ''}`),
            tags: ['billing', 'dispute', clientName, invoiceNumber],
        });
    }
    async createFromReport(tenantId, userId, report) {
        const clientName = report.client.companyName || report.client.name;
        const dateLabel = report.reportDate.toISOString().slice(0, 10);
        const parsedSummary = this.safeSummaryText(report.summary);
        return this.createEntry(tenantId, userId, {
            title: `Published report: ${report.site.name} ${dateLabel}`,
            category: 'operations',
            sourceType: 'daily_report',
            sourceId: report.id,
            summary: `Published daily report for ${report.site.name} and ${clientName} on ${dateLabel}. ${parsedSummary.slice(0, 240)}`,
            detailedContent: parsedSummary,
            keywords: this.extractKeywords(parsedSummary),
            tags: ['report', 'operations', report.site.name, clientName, dateLabel],
        });
    }
    async createFromAiAction(tenantId, userId, action) {
        return this.createEntry(tenantId, userId, {
            title: `Approved AI action: ${action.title}`,
            category: this.categoryForAction(action.targetModule),
            sourceType: 'ai_action',
            sourceId: action.id,
            summary: `${action.actionType} approved for ${action.targetModule}. ${action.title}`,
            detailedContent: [
                action.description,
                '',
                `Action type: ${action.actionType}`,
                `Target: ${action.targetModule}${action.targetEntityId ? `/${action.targetEntityId}` : ''}`,
            ].join('\n'),
            keywords: this.extractKeywords(`${action.title} ${action.description} ${action.actionType} ${action.targetModule}`),
            tags: ['ai_action', action.actionType, action.targetModule],
        });
    }
    async findAll(tenantId, userId, filters) {
        const category = this.optionalCategory(filters.category);
        const includeArchived = filters.includeArchived === 'true';
        const tag = filters.tag?.trim();
        const entries = await this.prisma.knowledgeEntry.findMany({
            where: {
                tenantId,
                ...(category ? { category } : {}),
                ...(tag ? { tags: { has: tag } } : {}),
                ...(includeArchived ? {} : { archivedAt: null }),
            },
            orderBy: [{ updatedAt: 'desc' }],
        });
        await this.auditService.log({
            tenantId,
            userId,
            action: 'KNOWLEDGE_SEARCHED',
            entityType: 'KnowledgeEntry',
            details: `Knowledge list viewed${category ? ` for ${category}` : ''}`,
        });
        return entries;
    }
    async findOne(tenantId, userId, id) {
        const entry = await this.prisma.knowledgeEntry.findFirst({
            where: { id, tenantId },
        });
        if (!entry) {
            throw new common_1.NotFoundException('Knowledge entry not found');
        }
        await this.auditService.log({
            tenantId,
            userId,
            action: 'KNOWLEDGE_VIEWED',
            entityType: 'KnowledgeEntry',
            entityId: entry.id,
            details: `Knowledge entry "${entry.title}" viewed`,
        });
        return entry;
    }
    async search(tenantId, userId, filters) {
        const entries = await this.findRelevantEntries({
            tenantId,
            query: filters.q || '',
            categories: filters.category ? [this.optionalCategory(filters.category)].filter(Boolean) : undefined,
            tags: filters.tag ? [filters.tag] : undefined,
            limit: 50,
        });
        await this.auditService.log({
            tenantId,
            userId,
            action: 'KNOWLEDGE_SEARCHED',
            entityType: 'KnowledgeEntry',
            details: `Knowledge searched for "${filters.q || filters.tag || filters.category || 'all'}"`,
        });
        return entries;
    }
    async update(tenantId, userId, id, dto) {
        await this.findOne(tenantId, userId, id);
        const data = this.normalizePartialInput(dto);
        const updated = await this.prisma.knowledgeEntry.update({
            where: { id },
            data,
        });
        await this.auditService.log({
            tenantId,
            userId,
            action: 'KNOWLEDGE_UPDATED',
            entityType: 'KnowledgeEntry',
            entityId: updated.id,
            details: `Knowledge entry "${updated.title}" updated`,
        });
        return updated;
    }
    async archive(tenantId, userId, id) {
        await this.findOne(tenantId, userId, id);
        const archived = await this.prisma.knowledgeEntry.update({
            where: { id },
            data: { archivedAt: new Date() },
        });
        await this.auditService.log({
            tenantId,
            userId,
            action: 'KNOWLEDGE_ARCHIVED',
            entityType: 'KnowledgeEntry',
            entityId: archived.id,
            details: `Knowledge entry "${archived.title}" archived`,
        });
        return archived;
    }
    async findRelevantEntries(input) {
        const terms = this.extractKeywords(input.query).slice(0, 12);
        const shouldClauses = terms.flatMap((term) => [
            { title: { contains: term, mode: 'insensitive' } },
            { summary: { contains: term, mode: 'insensitive' } },
            { detailedContent: { contains: term, mode: 'insensitive' } },
            { keywords: { has: term } },
            { tags: { has: term } },
        ]);
        const entries = await this.prisma.knowledgeEntry.findMany({
            where: {
                tenantId: input.tenantId,
                archivedAt: null,
                ...(input.categories?.length ? { category: { in: input.categories } } : {}),
                ...(input.tags?.length ? { tags: { hasSome: input.tags } } : {}),
                ...(input.sourceType ? { sourceType: input.sourceType } : {}),
                ...(input.excludeSourceId ? { sourceId: { not: input.excludeSourceId } } : {}),
                ...(shouldClauses.length ? { OR: shouldClauses } : {}),
            },
            orderBy: [{ updatedAt: 'desc' }],
            take: Math.max(input.limit ?? 8, 20),
        });
        return entries
            .map((entry) => ({
            ...entry,
            relevanceScore: this.scoreEntry(entry, terms, input.tags || []),
        }))
            .sort((left, right) => right.relevanceScore - left.relevanceScore || right.updatedAt.getTime() - left.updatedAt.getTime())
            .slice(0, input.limit ?? 8);
    }
    normalizeEntryInput(input) {
        const title = input.title?.trim();
        const summary = input.summary?.trim();
        const detailedContent = input.detailedContent?.trim();
        if (!title || !summary || !detailedContent) {
            throw new common_1.BadRequestException('Title, summary, and detailedContent are required');
        }
        return {
            title,
            category: this.requireCategory(input.category),
            sourceType: input.sourceType?.trim() || null,
            sourceId: input.sourceId?.trim() || null,
            summary,
            detailedContent,
            keywords: this.cleanList(input.keywords),
            tags: this.cleanList(input.tags),
        };
    }
    normalizePartialInput(input) {
        return {
            ...(input.title !== undefined ? { title: this.requiredText(input.title, 'title') } : {}),
            ...(input.category !== undefined ? { category: this.requireCategory(input.category) } : {}),
            ...(input.sourceType !== undefined ? { sourceType: input.sourceType?.trim() || null } : {}),
            ...(input.sourceId !== undefined ? { sourceId: input.sourceId?.trim() || null } : {}),
            ...(input.summary !== undefined ? { summary: this.requiredText(input.summary, 'summary') } : {}),
            ...(input.detailedContent !== undefined ? { detailedContent: this.requiredText(input.detailedContent, 'detailedContent') } : {}),
            ...(input.keywords !== undefined ? { keywords: this.cleanList(input.keywords) } : {}),
            ...(input.tags !== undefined ? { tags: this.cleanList(input.tags) } : {}),
            archivedAt: null,
        };
    }
    requiredText(value, fieldName) {
        const text = value?.trim();
        if (!text) {
            throw new common_1.BadRequestException(`${fieldName} cannot be empty`);
        }
        return text;
    }
    requireCategory(value) {
        if (!knowledge_base_types_1.KNOWLEDGE_CATEGORIES.includes(value)) {
            throw new common_1.BadRequestException(`Unsupported knowledge category: ${value}`);
        }
        return value;
    }
    optionalCategory(value) {
        return value ? this.requireCategory(value) : undefined;
    }
    cleanList(values) {
        return Array.from(new Set((values || [])
            .map((value) => value.trim())
            .filter(Boolean)
            .map((value) => value.slice(0, 80))));
    }
    extractKeywords(text) {
        const stopWords = new Set([
            'the', 'and', 'for', 'with', 'that', 'this', 'from', 'were', 'was',
            'are', 'has', 'have', 'had', 'into', 'after', 'before', 'during',
            'site', 'guard', 'client', 'incident', 'resolved', 'approved',
        ]);
        return Array.from(new Set((text || '')
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, ' ')
            .split(/\s+/)
            .map((term) => term.trim())
            .filter((term) => term.length >= 3 && !stopWords.has(term))))
            .slice(0, 20);
    }
    scoreEntry(entry, terms, tags) {
        const haystack = `${entry.title} ${entry.summary} ${entry.detailedContent}`.toLowerCase();
        const keywordSet = new Set(entry.keywords.map((keyword) => keyword.toLowerCase()));
        const tagSet = new Set(entry.tags.map((tag) => tag.toLowerCase()));
        return terms.reduce((score, term) => {
            let next = score;
            if (entry.title.toLowerCase().includes(term))
                next += 5;
            if (entry.summary.toLowerCase().includes(term))
                next += 3;
            if (haystack.includes(term))
                next += 1;
            if (keywordSet.has(term))
                next += 4;
            if (tagSet.has(term))
                next += 4;
            return next;
        }, tags.reduce((score, tag) => score + (tagSet.has(tag.toLowerCase()) ? 6 : 0), 0));
    }
    safeSummaryText(summary) {
        try {
            const parsed = JSON.parse(summary);
            return JSON.stringify(parsed, null, 2);
        }
        catch {
            return summary;
        }
    }
    categoryForAction(targetModule) {
        switch (targetModule) {
            case 'invoice':
            case 'billing':
            case 'revenue':
                return 'billing';
            case 'shift':
            case 'guard':
                return 'staffing';
            case 'client':
                return 'client_management';
            case 'site':
            case 'incident':
                return 'incidents';
            default:
                return 'operations';
        }
    }
};
exports.KnowledgeBaseService = KnowledgeBaseService;
exports.KnowledgeBaseService = KnowledgeBaseService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], KnowledgeBaseService);
//# sourceMappingURL=knowledge-base.service.js.map