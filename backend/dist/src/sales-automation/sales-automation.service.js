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
var SalesAutomationService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SalesAutomationService = void 0;
const common_1 = require("@nestjs/common");
const audit_service_1 = require("../audit/audit.service");
const prisma_service_1 = require("../prisma/prisma.service");
const AUTOMATION_MARKER = '[Sales Automation]';
let SalesAutomationService = SalesAutomationService_1 = class SalesAutomationService {
    prisma;
    auditService;
    logger = new common_1.Logger(SalesAutomationService_1.name);
    timer = null;
    lastRunAt = null;
    lastRunSummary = null;
    running = false;
    constructor(prisma, auditService) {
        this.prisma = prisma;
        this.auditService = auditService;
    }
    onModuleInit() {
        if (this.isDisabled())
            return;
        const intervalMinutes = this.intervalMinutes();
        this.timer = setInterval(() => {
            void this.runAllTenants().catch((error) => {
                this.logger.error('Sales automation run failed', error);
            });
        }, intervalMinutes * 60 * 1000);
        this.timer.unref?.();
    }
    onModuleDestroy() {
        if (this.timer)
            clearInterval(this.timer);
    }
    getStatus() {
        return {
            enabled: !this.isDisabled(),
            intervalMinutes: this.intervalMinutes(),
            running: this.running,
            lastRunAt: this.lastRunAt,
            lastRunSummary: this.lastRunSummary,
            marker: AUTOMATION_MARKER,
        };
    }
    async runAllTenants() {
        if (this.running)
            return this.lastRunSummary || this.emptySummary();
        this.running = true;
        const aggregate = this.emptySummary();
        try {
            const tenants = await this.prisma.tenant.findMany({
                select: { id: true },
            });
            for (const tenant of tenants) {
                const summary = await this.runForTenant(tenant.id);
                aggregate.scannedDeals += summary.scannedDeals;
                aggregate.createdActivities += summary.createdActivities;
                aggregate.skippedDeals += summary.skippedDeals;
                aggregate.errors.push(...summary.errors);
            }
            this.lastRunAt = new Date();
            this.lastRunSummary = aggregate;
            return aggregate;
        }
        finally {
            this.running = false;
        }
    }
    async runForTenant(tenantId, userId) {
        const summary = this.emptySummary(tenantId);
        const now = new Date();
        const deals = await this.prisma.deal.findMany({
            where: {
                tenantId,
                NOT: [
                    { stage: { equals: 'Won', mode: 'insensitive' } },
                    { stage: { equals: 'Lost', mode: 'insensitive' } },
                    { stage: { equals: 'closed', mode: 'insensitive' } },
                    { stage: { equals: 'closed won', mode: 'insensitive' } },
                    { stage: { equals: 'closed lost', mode: 'insensitive' } },
                ],
            },
            include: {
                lead: true,
                activities: {
                    orderBy: { createdAt: 'desc' },
                    take: 20,
                },
                discoverySessions: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                },
                salesAssessments: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                },
            },
        });
        summary.scannedDeals = deals.length;
        for (const deal of deals) {
            try {
                const decision = this.followUpDecision(deal, now);
                if (!decision.shouldCreate) {
                    summary.skippedDeals += 1;
                    continue;
                }
                const activity = await this.prisma.activity.create({
                    data: {
                        type: decision.type,
                        subject: decision.subject,
                        description: decision.description,
                        dueDate: decision.dueDate,
                        dealId: deal.id,
                        tenantId,
                    },
                });
                await this.auditService.log({
                    tenantId,
                    userId,
                    action: 'AUTO_CREATE',
                    entityType: 'ACTIVITY',
                    entityId: activity.id,
                    details: `Sales automation created follow-up for ${deal.name}`,
                });
                summary.createdActivities += 1;
            }
            catch (error) {
                summary.errors.push({
                    dealId: deal.id,
                    message: error instanceof Error ? error.message : 'Unable to automate follow-up',
                });
            }
        }
        this.lastRunAt = new Date();
        this.lastRunSummary = summary;
        return summary;
    }
    followUpDecision(deal, now) {
        const pendingActivities = deal.activities.filter((activity) => activity.status !== 'completed');
        const hasOpenAutomationTask = pendingActivities.some((activity) => String(activity.description || '').includes(AUTOMATION_MARKER));
        if (hasOpenAutomationTask) {
            return { shouldCreate: false };
        }
        const nextPending = pendingActivities
            .filter((activity) => activity.dueDate && activity.dueDate >= now)
            .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())[0];
        if (nextPending) {
            return { shouldCreate: false };
        }
        const lastActivity = deal.activities[0] || null;
        const daysSinceActivity = lastActivity
            ? Math.floor((now.getTime() - lastActivity.createdAt.getTime()) / (1000 * 60 * 60 * 24))
            : null;
        const assessment = deal.salesAssessments[0] || null;
        const discovery = deal.discoverySessions[0] || null;
        const reasons = [];
        if (daysSinceActivity === null)
            reasons.push('No activity has been logged for this deal.');
        else if (daysSinceActivity >= 7)
            reasons.push(`No activity has been logged for ${daysSinceActivity} days.`);
        if (!discovery)
            reasons.push('Discovery is missing.');
        if ((assessment?.closeReadinessScore ?? 100) < 55)
            reasons.push('Close readiness is below target.');
        if ((assessment?.discoveryQualityScore ?? 100) < 60)
            reasons.push('Discovery quality is below target.');
        if ((assessment?.objectionRisks?.length || discovery?.objections?.length || 0) > 0) {
            reasons.push('Buyer objections need follow-up.');
        }
        if (reasons.length === 0) {
            return { shouldCreate: false };
        }
        const dueDate = new Date(now);
        dueDate.setDate(dueDate.getDate() + 1);
        dueDate.setHours(9, 0, 0, 0);
        const subject = assessment?.recommendedNextAction?.slice(0, 90) ||
            `Follow up with ${deal.lead.company}`;
        return {
            shouldCreate: true,
            type: deal.lead.email ? 'email' : 'task',
            subject,
            dueDate,
            description: [
                AUTOMATION_MARKER,
                `Deal: ${deal.name}`,
                `Company: ${deal.lead.company}`,
                `Recommended action: ${assessment?.recommendedNextAction || 'Restart the conversation and confirm the next step.'}`,
                `Reasons: ${reasons.join(' ')}`,
            ].join('\n'),
        };
    }
    intervalMinutes() {
        const value = Number(process.env.SALES_AUTOMATION_INTERVAL_MINUTES || 1440);
        return Number.isFinite(value) && value >= 5 ? value : 1440;
    }
    isDisabled() {
        return process.env.SALES_AUTOMATION_DISABLED === 'true';
    }
    emptySummary(tenantId) {
        return {
            tenantId,
            scannedDeals: 0,
            createdActivities: 0,
            skippedDeals: 0,
            errors: [],
        };
    }
};
exports.SalesAutomationService = SalesAutomationService;
exports.SalesAutomationService = SalesAutomationService = SalesAutomationService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], SalesAutomationService);
//# sourceMappingURL=sales-automation.service.js.map