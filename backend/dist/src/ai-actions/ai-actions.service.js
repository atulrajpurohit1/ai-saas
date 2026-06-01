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
exports.AiActionsService = void 0;
const common_1 = require("@nestjs/common");
const activities_service_1 = require("../activities/activities.service");
const audit_service_1 = require("../audit/audit.service");
const prisma_service_1 = require("../prisma/prisma.service");
const ai_actions_types_1 = require("./ai-actions.types");
let AiActionsService = class AiActionsService {
    prisma;
    auditService;
    activitiesService;
    constructor(prisma, auditService, activitiesService) {
        this.prisma = prisma;
        this.auditService = auditService;
        this.activitiesService = activitiesService;
    }
    async syncFromRecommendations(tenantId, recommendations, userId) {
        const drafts = recommendations.map((recommendation) => this.toActionDraft(recommendation));
        const actions = [];
        for (const draft of drafts) {
            const existing = await this.prisma.recommendationAction.findFirst({
                where: {
                    tenantId,
                    recommendationId: draft.recommendationId,
                },
            });
            if (existing) {
                if (existing.status === 'pending' || existing.status === 'failed') {
                    actions.push(await this.prisma.recommendationAction.update({
                        where: { id: existing.id },
                        data: {
                            actionType: draft.actionType,
                            title: draft.title,
                            description: draft.description,
                            targetModule: draft.targetModule,
                            targetEntityId: draft.targetEntityId ?? null,
                            failureReason: existing.status === 'failed' ? existing.failureReason : null,
                        },
                    }));
                }
                else {
                    actions.push(existing);
                }
                continue;
            }
            const created = await this.prisma.recommendationAction.create({
                data: {
                    tenantId,
                    recommendationId: draft.recommendationId,
                    actionType: draft.actionType,
                    title: draft.title,
                    description: draft.description,
                    targetModule: draft.targetModule,
                    targetEntityId: draft.targetEntityId ?? null,
                },
            });
            actions.push(created);
            await this.auditService.log({
                tenantId,
                userId,
                action: 'AI_ACTION_CREATED',
                entityType: 'RecommendationAction',
                entityId: created.id,
                details: `${created.actionType}: ${created.title}`,
            });
        }
        return actions;
    }
    async findAll(tenantId, status) {
        const normalizedStatus = this.normalizeStatus(status);
        const actions = await this.prisma.recommendationAction.findMany({
            where: {
                tenantId,
                ...(normalizedStatus ? { status: normalizedStatus } : {}),
            },
            orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        });
        return {
            generatedAt: new Date().toISOString(),
            summary: this.buildSummary(actions),
            actions,
        };
    }
    async findOne(id, tenantId) {
        const action = await this.findAction(id, tenantId);
        return action;
    }
    async approve(id, tenantId, userId) {
        const action = await this.findAction(id, tenantId);
        if (action.status === 'approved')
            return action;
        if (!['pending', 'failed'].includes(action.status)) {
            throw new common_1.BadRequestException(`Only pending or failed actions can be approved. Current status: ${action.status}`);
        }
        const approved = await this.prisma.recommendationAction.update({
            where: { id },
            data: {
                status: 'approved',
                approvedBy: userId,
                approvedAt: new Date(),
                failureReason: null,
            },
        });
        await this.auditService.log({
            tenantId,
            userId,
            action: 'AI_ACTION_APPROVED',
            entityType: 'RecommendationAction',
            entityId: id,
            details: approved.title,
        });
        return approved;
    }
    async reject(id, tenantId, userId) {
        const action = await this.findAction(id, tenantId);
        if (action.status === 'rejected')
            return action;
        if (action.status === 'executed') {
            throw new common_1.BadRequestException('Executed actions cannot be rejected.');
        }
        const rejected = await this.prisma.recommendationAction.update({
            where: { id },
            data: {
                status: 'rejected',
                failureReason: null,
            },
        });
        await this.auditService.log({
            tenantId,
            userId,
            action: 'AI_ACTION_REJECTED',
            entityType: 'RecommendationAction',
            entityId: id,
            details: rejected.title,
        });
        return rejected;
    }
    async execute(id, tenantId, userId) {
        const action = await this.findAction(id, tenantId);
        if (action.status === 'executed')
            return action;
        if (action.status !== 'approved') {
            throw new common_1.BadRequestException(`Only approved actions can be executed. Current status: ${action.status}`);
        }
        try {
            await this.ensureTargetBelongsToTenant(action, tenantId);
            const result = await this.executeApprovedAction(action, tenantId, userId);
            const executed = await this.prisma.recommendationAction.update({
                where: { id },
                data: {
                    status: 'executed',
                    executedAt: new Date(),
                    failureReason: null,
                },
            });
            await this.auditService.log({
                tenantId,
                userId,
                action: 'AI_ACTION_EXECUTED',
                entityType: 'RecommendationAction',
                entityId: id,
                details: `${action.actionType}: ${result}`,
            });
            return executed;
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Action execution failed';
            const failed = await this.prisma.recommendationAction.update({
                where: { id },
                data: {
                    status: 'failed',
                    failureReason: message,
                },
            });
            await this.auditService.log({
                tenantId,
                userId,
                action: 'AI_ACTION_FAILED',
                entityType: 'RecommendationAction',
                entityId: id,
                details: message,
            });
            return failed;
        }
    }
    async findAction(id, tenantId) {
        const action = await this.prisma.recommendationAction.findFirst({
            where: { id, tenantId },
        });
        if (!action) {
            throw new common_1.NotFoundException('AI action not found');
        }
        return action;
    }
    async executeApprovedAction(action, tenantId, userId) {
        const subject = this.executionSubject(action);
        const description = this.executionDescription(action);
        const dueDate = this.dueDateFor(action.actionType);
        const activity = await this.activitiesService.create({
            type: this.activityTypeFor(action.actionType),
            subject,
            description,
            dueDate,
            tenantId,
            userId,
        });
        return `Created activity ${activity.id}`;
    }
    async ensureTargetBelongsToTenant(action, tenantId) {
        if (!action.targetEntityId)
            return;
        const where = { id: action.targetEntityId, tenantId };
        let exists = true;
        switch (action.targetModule) {
            case 'client':
                exists = Boolean(await this.prisma.client.findFirst({ where }));
                break;
            case 'site':
                exists = Boolean(await this.prisma.site.findFirst({ where }));
                break;
            case 'guard':
                exists = Boolean(await this.prisma.guard.findFirst({ where }));
                break;
            case 'shift':
                exists = Boolean(await this.prisma.shift.findFirst({ where }));
                break;
            case 'invoice':
                exists = Boolean(await this.prisma.invoice.findFirst({ where }));
                break;
            default:
                exists = true;
        }
        if (!exists) {
            throw new common_1.NotFoundException('Target entity not found for this tenant');
        }
    }
    toActionDraft(recommendation) {
        const actionType = recommendation.actionType ?? this.inferActionType(recommendation);
        const targetModule = recommendation.targetModule ?? this.inferTargetModule(recommendation);
        return {
            recommendationId: recommendation.id,
            actionType,
            title: recommendation.title,
            description: `${recommendation.action}\n\nReason: ${recommendation.reason}`,
            targetModule,
            targetEntityId: recommendation.targetEntityId ?? null,
        };
    }
    inferActionType(recommendation) {
        if (recommendation.source === 'ai' && !recommendation.targetEntityId) {
            return 'notify_admin';
        }
        switch (recommendation.category) {
            case 'billing':
            case 'revenue':
                return 'create_invoice_followup';
            case 'clients':
            case 'contracts':
            case 'renewals':
                return 'flag_client_risk';
            case 'sites':
            case 'incidents':
                return 'flag_site_risk';
            case 'guards':
                return 'suggest_guard_reassignment';
            default:
                return 'create_follow_up_task';
        }
    }
    inferTargetModule(recommendation) {
        switch (recommendation.category) {
            case 'clients':
            case 'contracts':
            case 'renewals':
                return 'client';
            case 'sites':
            case 'incidents':
                return 'site';
            case 'guards':
                return 'guard';
            case 'billing':
                return 'billing';
            case 'revenue':
                return 'revenue';
            default:
                return recommendation.source === 'ai' ? 'ai_insights' : 'operations';
        }
    }
    executionSubject(action) {
        switch (action.actionType) {
            case 'notify_admin':
                return `AI notification: ${action.title}`;
            case 'flag_client_risk':
                return `Client risk flag: ${action.title}`;
            case 'flag_site_risk':
                return `Site risk flag: ${action.title}`;
            case 'suggest_guard_reassignment':
                return `Guard reassignment review: ${action.title}`;
            case 'create_invoice_followup':
                return `Invoice follow-up: ${action.title}`;
            default:
                return `AI follow-up: ${action.title}`;
        }
    }
    executionDescription(action) {
        return [
            action.description,
            '',
            `AI action type: ${action.actionType}`,
            `Target: ${action.targetModule}${action.targetEntityId ? `/${action.targetEntityId}` : ''}`,
            'Execution is non-destructive: no guard assignments, invoices, proposals, or records were changed automatically.',
        ].join('\n');
    }
    activityTypeFor(actionType) {
        switch (actionType) {
            case 'notify_admin':
                return 'notification';
            case 'flag_client_risk':
            case 'flag_site_risk':
                return 'risk_flag';
            case 'create_invoice_followup':
                return 'follow_up';
            default:
                return 'task';
        }
    }
    dueDateFor(actionType) {
        if (actionType === 'notify_admin')
            return undefined;
        const dueDate = new Date();
        dueDate.setUTCDate(dueDate.getUTCDate() + (actionType === 'create_invoice_followup' ? 3 : 2));
        return dueDate;
    }
    normalizeStatus(status) {
        if (!status)
            return null;
        if (ai_actions_types_1.RECOMMENDATION_ACTION_STATUSES.includes(status)) {
            return status;
        }
        throw new common_1.BadRequestException(`Unsupported AI action status: ${status}`);
    }
    buildSummary(actions) {
        return ai_actions_types_1.RECOMMENDATION_ACTION_STATUSES.reduce((summary, status) => ({
            ...summary,
            [status]: actions.filter((action) => action.status === status).length,
        }), {});
    }
};
exports.AiActionsService = AiActionsService;
exports.AiActionsService = AiActionsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService,
        activities_service_1.ActivitiesService])
], AiActionsService);
//# sourceMappingURL=ai-actions.service.js.map