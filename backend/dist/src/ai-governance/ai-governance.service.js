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
exports.AiGovernanceService = exports.PROMPT_USAGE_REGISTRY = void 0;
const common_1 = require("@nestjs/common");
const audit_service_1 = require("../audit/audit.service");
const prisma_service_1 = require("../prisma/prisma.service");
const DEFAULT_PROMPT_VERSION = 'v5-phase-7';
exports.PROMPT_USAGE_REGISTRY = [
    {
        moduleName: 'ai_insights.dashboard',
        promptKey: 'business_recommendations',
        label: 'AI Insights',
        description: 'Operational recommendations for clients, guards, sites, and billing.',
        defaultVersion: DEFAULT_PROMPT_VERSION,
    },
    {
        moduleName: 'ai_insights.incident_risk',
        promptKey: 'incident_risk_summary',
        label: 'Incident Risk Analysis',
        description: 'Incident trends, high-risk sites, client risk, and guard risk summaries.',
        defaultVersion: DEFAULT_PROMPT_VERSION,
    },
    {
        moduleName: 'ai_insights.revenue',
        promptKey: 'revenue_summary',
        label: 'Revenue Forecasting',
        description: 'Executive revenue, renewal, collections, and contract-risk summary.',
        defaultVersion: DEFAULT_PROMPT_VERSION,
    },
    {
        moduleName: 'ai_insights.revenue',
        promptKey: 'financial_recommendations',
        label: 'Revenue Recommendations',
        description: 'Finance actions generated from forecasts, collections, renewals, and contract health.',
        defaultVersion: DEFAULT_PROMPT_VERSION,
    },
    {
        moduleName: 'ai_scheduling.guard_recommendations',
        promptKey: 'guard_recommendation_explanation',
        label: 'AI Smart Scheduling',
        description: 'Guard recommendation explanations for scheduling admins.',
        defaultVersion: DEFAULT_PROMPT_VERSION,
    },
];
let AiGovernanceService = class AiGovernanceService {
    prisma;
    auditService;
    constructor(prisma, auditService) {
        this.prisma = prisma;
        this.auditService = auditService;
    }
    async listPrompts(tenantId) {
        const prompts = await this.prisma.promptVersion.findMany({
            where: { tenantId },
            orderBy: [
                { moduleName: 'asc' },
                { promptKey: 'asc' },
                { status: 'asc' },
                { createdAt: 'desc' },
            ],
        });
        return exports.PROMPT_USAGE_REGISTRY.map((definition) => {
            const versions = prompts.filter((prompt) => prompt.moduleName === definition.moduleName &&
                prompt.promptKey === definition.promptKey);
            return {
                ...definition,
                activeVersion: versions.find((version) => version.status === 'active') ?? null,
                versions,
            };
        });
    }
    async createPromptVersion(tenantId, userId, dto) {
        this.ensureKnownPrompt(dto.moduleName, dto.promptKey);
        const status = dto.status ?? 'inactive';
        if (status === 'active') {
            await this.prisma.promptVersion.updateMany({
                where: {
                    tenantId,
                    moduleName: dto.moduleName,
                    promptKey: dto.promptKey,
                    status: 'active',
                },
                data: { status: 'inactive' },
            });
        }
        const created = await this.prisma.promptVersion.create({
            data: {
                tenantId,
                moduleName: dto.moduleName.trim(),
                promptKey: dto.promptKey.trim(),
                version: dto.version.trim(),
                promptText: dto.promptText.trim(),
                status,
                createdBy: userId,
            },
        });
        await this.auditService.log({
            tenantId,
            userId,
            action: 'AI_PROMPT_VERSION_CREATED',
            entityType: 'PromptVersion',
            entityId: created.id,
            details: `${created.moduleName}/${created.promptKey}@${created.version}`,
        });
        return created;
    }
    async activatePromptVersion(id, tenantId, userId) {
        const prompt = await this.findPrompt(id, tenantId);
        const updated = await this.prisma.$transaction(async (tx) => {
            await tx.promptVersion.updateMany({
                where: {
                    tenantId,
                    moduleName: prompt.moduleName,
                    promptKey: prompt.promptKey,
                    status: 'active',
                    id: { not: prompt.id },
                },
                data: { status: 'inactive' },
            });
            return tx.promptVersion.update({
                where: { id: prompt.id },
                data: { status: 'active' },
            });
        });
        await this.auditService.log({
            tenantId,
            userId,
            action: 'AI_PROMPT_VERSION_ACTIVATED',
            entityType: 'PromptVersion',
            entityId: updated.id,
            details: `${updated.moduleName}/${updated.promptKey}@${updated.version}`,
        });
        return updated;
    }
    async deactivatePromptVersion(id, tenantId, userId) {
        await this.findPrompt(id, tenantId);
        const updated = await this.prisma.promptVersion.update({
            where: { id },
            data: { status: 'inactive' },
        });
        await this.auditService.log({
            tenantId,
            userId,
            action: 'AI_PROMPT_VERSION_DEACTIVATED',
            entityType: 'PromptVersion',
            entityId: updated.id,
            details: `${updated.moduleName}/${updated.promptKey}@${updated.version}`,
        });
        return updated;
    }
    async resolvePromptVersion(input) {
        const promptKey = input.promptKey ?? this.defaultPromptKeyFor(input.moduleName);
        const active = await this.prisma.promptVersion.findFirst({
            where: {
                tenantId: input.tenantId,
                moduleName: input.moduleName,
                promptKey,
                status: 'active',
            },
            orderBy: { createdAt: 'desc' },
        });
        if (!active) {
            return {
                promptVersion: input.fallbackVersion ||
                    this.defaultVersionFor(input.moduleName, promptKey),
                promptVersionId: null,
                promptText: null,
            };
        }
        return {
            promptVersion: active.version,
            promptVersionId: active.id,
            promptText: active.promptText,
        };
    }
    async findAudit(tenantId) {
        const rows = await this.prisma.aiGeneration.findMany({
            where: { tenantId },
            include: {
                promptVersionRecord: {
                    select: {
                        id: true,
                        moduleName: true,
                        promptKey: true,
                        version: true,
                        status: true,
                    },
                },
                feedback: {
                    select: {
                        rating: true,
                        isUseful: true,
                        isAccurate: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
            take: 100,
        });
        return rows.map((row) => this.serializeGeneration(row));
    }
    async findAuditById(id, tenantId) {
        const generation = await this.prisma.aiGeneration.findFirst({
            where: { id, tenantId },
            include: {
                promptVersionRecord: true,
                feedback: {
                    orderBy: { createdAt: 'desc' },
                    take: 25,
                },
                actions: {
                    orderBy: { createdAt: 'desc' },
                    take: 25,
                },
            },
        });
        if (!generation) {
            throw new common_1.NotFoundException('AI audit record not found');
        }
        return this.serializeGeneration(generation);
    }
    async approveGeneration(id, tenantId, userId) {
        const generation = await this.prisma.aiGeneration.findFirst({
            where: { id, tenantId },
            select: {
                id: true,
                sourceModule: true,
                safetyStatus: true,
                approvalStatus: true,
            },
        });
        if (!generation) {
            throw new common_1.NotFoundException('AI audit record not found');
        }
        if (generation.safetyStatus === 'blocked') {
            throw new common_1.BadRequestException('Blocked AI output cannot be approved until the safety findings are fixed.');
        }
        const approved = await this.prisma.aiGeneration.update({
            where: { id: generation.id },
            data: {
                approvalStatus: 'approved',
                approvedBy: userId,
                approvedAt: new Date(),
            },
            include: {
                promptVersionRecord: true,
                feedback: true,
                actions: true,
            },
        });
        await this.auditService.log({
            tenantId,
            userId,
            action: 'AI_OUTPUT_APPROVED',
            entityType: 'AiGeneration',
            entityId: approved.id,
            details: `${approved.sourceModule} approved for publishing`,
        });
        return this.serializeGeneration(approved);
    }
    evaluateSafety(input) {
        const text = this.stringifyTextValues(input.generatedOutput);
        const findings = [];
        if (/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(text)) {
            findings.push({
                rule: 'sensitive_data_leakage',
                severity: 'blocked',
                message: 'Output includes an email address.',
            });
        }
        if (/\b\d{3}-\d{2}-\d{4}\b/.test(text)) {
            findings.push({
                rule: 'sensitive_data_leakage',
                severity: 'blocked',
                message: 'Output includes a possible SSN.',
            });
        }
        if (/\b(?:\d[ -]*?){13,16}\b/.test(text)) {
            findings.push({
                rule: 'sensitive_data_leakage',
                severity: 'blocked',
                message: 'Output includes a possible payment card number.',
            });
        }
        if (/\b(?:\+?\d[\s.-]?){10,14}\b/.test(text)) {
            findings.push({
                rule: 'sensitive_data_leakage',
                severity: 'review_required',
                message: 'Output may include a phone number.',
            });
        }
        if (/\b(automatically|auto)\b.{0,40}\b(assign|terminate|fire|charge|refund|publish|execute|send)\b/i.test(text)) {
            findings.push({
                rule: 'unsafe_automation',
                severity: 'blocked',
                message: 'Output appears to recommend unsafe automation without approval.',
            });
        }
        if (/\b(legal advice|tax advice|investment advice|guarantee(?:d)? returns?|legally binding)\b/i.test(text)) {
            findings.push({
                rule: 'unsupported_financial_or_legal_claim',
                severity: 'blocked',
                message: 'Output includes unsupported legal or financial claim language.',
            });
        }
        if (input.clientVisible &&
            this.inputReferencesMultipleClients(input.inputSource)) {
            findings.push({
                rule: 'client_cross_data_exposure',
                severity: 'review_required',
                message: 'Client-visible output was generated from multiple client contexts.',
            });
        }
        const status = findings.some((item) => item.severity === 'blocked')
            ? 'blocked'
            : findings.length > 0
                ? 'review_required'
                : 'passed';
        return { status, findings };
    }
    approvalStatusFor(input) {
        if (input.safetyStatus === 'blocked')
            return 'blocked';
        return input.clientVisible ? 'pending' : 'not_required';
    }
    toJsonValue(value) {
        try {
            return JSON.parse(JSON.stringify(value ?? null));
        }
        catch {
            return { value: String(value) };
        }
    }
    ensureKnownPrompt(moduleName, promptKey) {
        const known = exports.PROMPT_USAGE_REGISTRY.some((item) => item.moduleName === moduleName && item.promptKey === promptKey);
        if (!known) {
            throw new common_1.BadRequestException(`Unsupported AI prompt target: ${moduleName}/${promptKey}`);
        }
    }
    async findPrompt(id, tenantId) {
        const prompt = await this.prisma.promptVersion.findFirst({
            where: { id, tenantId },
        });
        if (!prompt) {
            throw new common_1.NotFoundException('Prompt version not found');
        }
        return prompt;
    }
    defaultPromptKeyFor(moduleName) {
        return (exports.PROMPT_USAGE_REGISTRY.find((item) => item.moduleName === moduleName)
            ?.promptKey ?? 'default');
    }
    defaultVersionFor(moduleName, promptKey) {
        return (exports.PROMPT_USAGE_REGISTRY.find((item) => item.moduleName === moduleName && item.promptKey === promptKey)?.defaultVersion ?? DEFAULT_PROMPT_VERSION);
    }
    serializeGeneration(generation) {
        const feedback = Array.isArray(generation.feedback)
            ? generation.feedback
            : [];
        const feedbackScore = feedback.length === 0
            ? null
            : Math.round((feedback.reduce((sum, item) => sum + item.rating, 0) /
                feedback.length) *
                100) / 100;
        return {
            ...generation,
            safetyFindings: Array.isArray(generation.safetyFindings)
                ? generation.safetyFindings
                : [],
            feedbackScore,
            feedbackCount: feedback.length,
        };
    }
    stringifyTextValues(value) {
        const values = [];
        const visit = (item) => {
            if (typeof item === 'string') {
                values.push(item);
                return;
            }
            if (Array.isArray(item)) {
                item.forEach(visit);
                return;
            }
            if (item && typeof item === 'object') {
                Object.values(item).forEach(visit);
            }
        };
        visit(value);
        return values.join('\n');
    }
    inputReferencesMultipleClients(value) {
        if (!value || typeof value !== 'object')
            return false;
        const source = value;
        return ((Array.isArray(source.clientIds) &&
            new Set(source.clientIds.filter(Boolean)).size > 1) ||
            source.scope === 'multi_client');
    }
};
exports.AiGovernanceService = AiGovernanceService;
exports.AiGovernanceService = AiGovernanceService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], AiGovernanceService);
//# sourceMappingURL=ai-governance.service.js.map