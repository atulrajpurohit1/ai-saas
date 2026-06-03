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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var CommandCenterService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommandCenterService = void 0;
const common_1 = require("@nestjs/common");
const ai_governance_service_1 = require("../ai-governance/ai-governance.service");
const ai_insights_service_1 = require("../ai-insights/ai-insights.service");
const recommendation_service_1 = require("../ai-insights/recommendation.service");
const ai_actions_service_1 = require("../ai-actions/ai-actions.service");
const ai_monitoring_service_1 = require("../ai-monitoring/ai-monitoring.service");
const revenue_insights_service_1 = require("../ai-insights/revenue-insights.service");
const ai_service_1 = require("../ai/ai.service");
const prisma_service_1 = require("../prisma/prisma.service");
const knowledge_retrieval_service_1 = require("../knowledge-base/knowledge-retrieval.service");
let CommandCenterService = CommandCenterService_1 = class CommandCenterService {
    prisma;
    aiInsightsService;
    revenueInsightsService;
    recommendationService;
    aiActionsService;
    aiService;
    aiMonitoringService;
    aiGovernanceService;
    knowledgeRetrievalService;
    logger = new common_1.Logger(CommandCenterService_1.name);
    promptVersion = 'v5-phase-7';
    constructor(prisma, aiInsightsService, revenueInsightsService, recommendationService, aiActionsService, aiService, aiMonitoringService, aiGovernanceService, knowledgeRetrievalService) {
        this.prisma = prisma;
        this.aiInsightsService = aiInsightsService;
        this.revenueInsightsService = revenueInsightsService;
        this.recommendationService = recommendationService;
        this.aiActionsService = aiActionsService;
        this.aiService = aiService;
        this.aiMonitoringService = aiMonitoringService;
        this.aiGovernanceService = aiGovernanceService;
        this.knowledgeRetrievalService = knowledgeRetrievalService;
    }
    async getDashboard(tenantId, userId, userRole) {
        const now = new Date();
        const [opsDashboard, incidentInsights, revenueDashboard, schedulingOverview, guardsOnDuty, openIncidents] = await Promise.all([
            this.aiInsightsService.getDashboard(tenantId, userId),
            this.aiInsightsService.getIncidentInsights(tenantId, userId),
            this.revenueInsightsService.getRevenueDashboard(tenantId, userId),
            this.recommendationService.getSchedulingOverview(tenantId),
            this.countGuardsOnDuty(tenantId, now),
            this.countOpenIncidents(tenantId)
        ]);
        const recommendations = this.buildUnifiedRecommendations(opsDashboard.recommendations, revenueDashboard.recommendations.recommendations, schedulingOverview.recommendations);
        await this.syncPendingActions(tenantId, userId, userRole, recommendations);
        const risks = this.buildUnifiedRisks(incidentInsights.highRiskSites, incidentInsights.clientRisks, revenueDashboard.contracts.rows);
        const overview = this.buildOverview(opsDashboard, revenueDashboard, schedulingOverview, guardsOnDuty, openIncidents);
        const workforce = this.buildWorkforceHealth(opsDashboard.guards);
        const financial = this.buildFinancialHealth(revenueDashboard, opsDashboard.billing);
        const dailySummary = await this.generateDailySummary(tenantId, now, overview, risks, workforce, financial, schedulingOverview, recommendations);
        const isAiAssisted = dailySummary.source === 'ai_assisted' ||
            opsDashboard.source === 'ai_assisted' ||
            revenueDashboard.source === 'ai_assisted';
        const dashboard = {
            generatedAt: now.toISOString(),
            source: isAiAssisted ? 'ai_assisted' : 'rule_based',
            overview,
            risks,
            workforce,
            financial,
            scheduling: schedulingOverview,
            recommendations,
            dailySummary
        };
        const generation = await this.aiMonitoringService.logGeneration({
            tenantId,
            createdBy: userId,
            promptVersion: this.promptVersion,
            promptKey: 'daily_summary',
            modelUsed: this.aiService.getModelName(),
            sourceModule: 'ai_command_center.dashboard',
            generatedOutput: dashboard,
            fallbackUsed: dailySummary.source !== 'ai_assisted',
            status: isAiAssisted ? 'success' : 'fallback',
        });
        return {
            ...dashboard,
            aiGenerationId: generation?.id,
            recommendations: this.aiMonitoringService.attachGenerationId(dashboard.recommendations, generation?.id),
        };
    }
    async getSummary(tenantId, userId, userRole) {
        const dashboard = await this.getDashboard(tenantId, userId, userRole);
        return dashboard.dailySummary;
    }
    async getRecommendations(tenantId, userId, userRole) {
        const [opsDashboard, revenueDashboard, schedulingOverview] = await Promise.all([
            this.aiInsightsService.getDashboard(tenantId, userId),
            this.revenueInsightsService.getRevenueDashboard(tenantId, userId),
            this.recommendationService.getSchedulingOverview(tenantId),
        ]);
        const recommendations = this.buildUnifiedRecommendations(opsDashboard.recommendations, revenueDashboard.recommendations.recommendations, schedulingOverview.recommendations);
        await this.syncPendingActions(tenantId, userId, userRole, recommendations);
        return recommendations;
    }
    async getRisks(tenantId, userId) {
        const [incidentInsights, revenueDashboard] = await Promise.all([
            this.aiInsightsService.getIncidentInsights(tenantId),
            this.revenueInsightsService.getRevenueDashboard(tenantId, userId)
        ]);
        return this.buildUnifiedRisks(incidentInsights.highRiskSites, incidentInsights.clientRisks, revenueDashboard.contracts.rows);
    }
    async countGuardsOnDuty(tenantId, now) {
        const activeShifts = await this.prisma.shift.findMany({
            where: {
                tenantId,
                startTime: { lte: now },
                endTime: { gte: now },
                status: { not: 'cancelled' }
            },
            select: {
                attendanceEvents: {
                    where: {
                        type: 'CHECK_IN'
                    },
                    select: {
                        guardId: true
                    }
                }
            }
        });
        const onDutyGuardIds = new Set();
        activeShifts.forEach(shift => {
            shift.attendanceEvents.forEach(event => {
                onDutyGuardIds.add(event.guardId);
            });
        });
        return onDutyGuardIds.size;
    }
    async syncPendingActions(tenantId, userId, userRole, recommendations) {
        if (userRole !== 'admin' || recommendations.length === 0)
            return;
        try {
            await this.aiActionsService.syncFromRecommendations(tenantId, recommendations, userId);
        }
        catch (error) {
            this.logger.warn(`Failed to sync AI actions: ${error}`);
        }
    }
    async countOpenIncidents(tenantId) {
        return this.prisma.incident.count({
            where: {
                tenantId,
                status: { in: ['open', 'investigating'] }
            }
        });
    }
    buildOverview(opsDashboard, revenueDashboard, schedulingOverview, guardsOnDuty, openIncidents) {
        const activeClients = opsDashboard.clients.rows.filter((c) => c.active).length;
        const totalClients = opsDashboard.clients.rows.length;
        const activeSites = opsDashboard.sites.rows.length;
        const totalGuards = opsDashboard.guards.rows.length;
        const outstandingInvoices = opsDashboard.billing.rows.reduce((sum, row) => sum + (row.outstandingAmount > 0 ? row.invoiceCount : 0), 0);
        const outstandingAmount = opsDashboard.billing.rows.reduce((sum, row) => sum + row.outstandingAmount, 0);
        const revenueForecast = revenueDashboard.forecast.nextMonthRevenue;
        const staffingAlerts = schedulingOverview.coverageGaps;
        const coverageGaps = opsDashboard.sites.summary.find((m) => m.label === 'Coverage issues')?.value || 0;
        return {
            activeClients,
            totalClients,
            activeSites,
            guardsOnDuty,
            totalGuards,
            openIncidents,
            outstandingInvoices,
            outstandingAmount,
            revenueForecast,
            revenueForecastLabel: 'Next Month Forecast',
            staffingAlerts,
            coverageGaps: schedulingOverview.shortageSlots ||
                (typeof coverageGaps === 'number' ? coverageGaps : parseInt(coverageGaps) || 0),
            metrics: [
                { label: 'Active Clients', value: activeClients, tone: 'info' },
                { label: 'Guards on Duty', value: guardsOnDuty, tone: guardsOnDuty > 0 ? 'positive' : 'warning' },
                { label: 'Open Incidents', value: openIncidents, tone: openIncidents > 0 ? 'warning' : 'positive' },
                { label: 'Revenue Forecast', value: revenueForecast, tone: 'positive' }
            ]
        };
    }
    buildWorkforceHealth(guardInsights) {
        const attendanceSummary = guardInsights.summary.find((m) => m.label === 'Attendance rate');
        let overallAttendanceRate = null;
        if (attendanceSummary && attendanceSummary.value !== 'N/A') {
            overallAttendanceRate = parseFloat(attendanceSummary.value.toString().replace('%', ''));
        }
        const totalLateCheckIns = guardInsights.summary.find((m) => m.label === 'Late check-ins')?.value || 0;
        const totalMissedShifts = guardInsights.summary.find((m) => m.label === 'Missed shifts')?.value || 0;
        return {
            totalGuards: guardInsights.rows.length,
            overallAttendanceRate,
            totalLateCheckIns: typeof totalLateCheckIns === 'number' ? totalLateCheckIns : parseInt(totalLateCheckIns) || 0,
            totalMissedShifts: typeof totalMissedShifts === 'number' ? totalMissedShifts : parseInt(totalMissedShifts) || 0,
            guards: guardInsights.rows.map((g) => ({
                guardId: g.guardId,
                name: g.name,
                scheduledShifts: g.scheduledShifts,
                attendanceRate: g.attendanceRate,
                lateCheckIns: g.lateCheckIns,
                missedShifts: g.missedShifts,
                incidentCount: g.incidentCount
            })),
            recommendations: guardInsights.insights.map((i) => i.message),
            metrics: guardInsights.summary
        };
    }
    buildFinancialHealth(revenueDashboard, billingInsights) {
        return {
            forecastedRevenue: revenueDashboard.forecast.nextMonthRevenue,
            quarterlyForecast: revenueDashboard.forecast.quarterlyForecast,
            annualForecast: revenueDashboard.forecast.annualForecast,
            outstandingBalance: revenueDashboard.forecast.outstandingAmount,
            disputedAmount: billingInsights.rows.reduce((sum, row) => sum + row.disputedAmount, 0),
            disputedInvoiceCount: billingInsights.summary.find((m) => m.label === 'Disputed')?.detail ? parseInt(billingInsights.summary.find((m) => m.label === 'Disputed').detail) : 0,
            paidAmount: billingInsights.rows.reduce((sum, row) => sum + row.paidAmount, 0),
            collectionRate: null,
            averagePaymentDays: revenueDashboard.contracts.rows.reduce((acc, cur) => acc + (cur.averagePaymentDays || 0), 0) / (revenueDashboard.contracts.rows.filter((c) => c.averagePaymentDays !== null).length || 1),
            monthlyGrowthRate: revenueDashboard.forecast.monthlyGrowthRate,
            expectedCollections: revenueDashboard.forecast.expectedCollections,
            metrics: [
                ...revenueDashboard.forecast.summary,
                ...billingInsights.summary
            ].slice(0, 4)
        };
    }
    buildUnifiedRisks(siteRisks, clientRisks, contractRisks) {
        const formattedSites = siteRisks.map(r => ({
            id: r.entityId,
            entityType: 'site',
            name: r.name,
            relatedName: r.relatedName,
            riskScore: r.riskScore,
            riskLevel: r.riskLevel,
            incidentCount: r.incidentCount,
            indicators: r.indicators
        }));
        const formattedClients = clientRisks.map(r => ({
            id: r.entityId,
            entityType: 'client',
            name: r.name,
            relatedName: null,
            riskScore: r.riskScore,
            riskLevel: r.riskLevel,
            incidentCount: r.incidentCount,
            indicators: r.indicators
        }));
        const formattedContracts = contractRisks
            .filter(c => c.healthScore <= 50)
            .map(c => ({
            id: c.clientId,
            entityType: 'contract',
            name: c.name,
            relatedName: null,
            riskScore: 100 - c.healthScore,
            riskLevel: c.healthStatus === 'High Risk' ? 'critical' : 'high',
            incidentCount: c.incidentCount,
            indicators: c.indicators
        }));
        const allRisks = [...formattedSites, ...formattedClients, ...formattedContracts];
        const totalHighRisk = allRisks.filter(r => r.riskLevel === 'high').length;
        const totalCritical = allRisks.filter(r => r.riskLevel === 'critical').length;
        return {
            sites: formattedSites,
            clients: formattedClients,
            contracts: formattedContracts,
            totalHighRisk,
            totalCritical
        };
    }
    buildUnifiedRecommendations(opsRecs, revenueRecs, schedulingRecs = []) {
        const all = [...(opsRecs || []), ...(revenueRecs || []), ...(schedulingRecs || [])];
        const unique = Array.from(new Map(all.map(item => [item.id, item])).values());
        const priorityWeight = { high: 3, medium: 2, low: 1 };
        return unique.sort((a, b) => {
            const pA = priorityWeight[a.priority] || 0;
            const pB = priorityWeight[b.priority] || 0;
            return pB - pA;
        }).slice(0, 10);
    }
    async generateDailySummary(tenantId, now, overview, risks, workforce, financial, schedulingOverview, recommendations) {
        const formattedDate = now.toLocaleDateString('en-US', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
        const fallbackSummary = {
            date: formattedDate,
            incidentSummary: `Currently monitoring ${overview.openIncidents} open incidents. We have ${risks.totalCritical} critical risks identified across sites and clients.`,
            attendanceSummary: workforce.overallAttendanceRate
                ? `Overall attendance rate is ${workforce.overallAttendanceRate}%. Recorded ${workforce.totalLateCheckIns} late check-ins and ${workforce.totalMissedShifts} missed shifts recently.`
                : 'Attendance data is currently being collected.',
            staffingSummary: `Operating with ${overview.guardsOnDuty} guards currently on duty across ${overview.activeSites} active sites. ${schedulingOverview.shortageSlots} upcoming guard slots need coverage.`,
            financeSummary: `Next month's revenue forecast is ${financial.forecastedRevenue}. Monitoring a disputed amount of ${financial.disputedAmount}.`,
            topRecommendations: recommendations.slice(0, 3).map(r => r.action),
            aiNarrative: '',
            source: 'rule_based'
        };
        try {
            const feedbackSummary = await this.aiMonitoringService.getFeedbackSummaryForPrompt(tenantId);
            const organizationalMemory = await this.knowledgeRetrievalService?.retrieveRelevant({
                tenantId,
                sourceModule: 'ai_command_center.dashboard',
                categories: ['operations', 'incidents', 'staffing', 'billing', 'client_management', 'scheduling'],
                query: [
                    fallbackSummary.incidentSummary,
                    fallbackSummary.attendanceSummary,
                    fallbackSummary.staffingSummary,
                    fallbackSummary.financeSummary,
                    ...fallbackSummary.topRecommendations,
                ].join(' '),
                limit: 8,
            });
            const context = {
                activeClients: overview.activeClients,
                guardsOnDuty: overview.guardsOnDuty,
                openIncidents: overview.openIncidents,
                criticalRisks: risks.totalCritical,
                attendanceRate: workforce.overallAttendanceRate,
                revenueForecast: financial.forecastedRevenue,
                outstandingBalance: financial.outstandingBalance,
                upcomingCoverageGaps: schedulingOverview.coverageGaps,
                upcomingShortageSlots: schedulingOverview.shortageSlots,
                topRecommendations: recommendations.slice(0, 3).map(r => r.action),
                adminFeedbackHistory: feedbackSummary.summaryText,
                organizationalMemory: organizationalMemory?.map((entry) => ({
                    title: entry.title,
                    category: entry.category,
                    summary: entry.summary,
                    tags: entry.tags,
                })) || [],
            };
            const aiNarrative = await this.aiService.generateIncidentRiskSummary(JSON.stringify(context), await this.resolvePromptTemplate(tenantId, 'ai_command_center.dashboard', 'daily_summary'));
            if (aiNarrative) {
                return {
                    ...fallbackSummary,
                    aiNarrative,
                    source: 'ai_assisted'
                };
            }
        }
        catch (error) {
            this.logger.warn(`Failed to generate AI daily summary: ${error}`);
        }
        fallbackSummary.aiNarrative = `${fallbackSummary.staffingSummary} ${fallbackSummary.incidentSummary} ${fallbackSummary.financeSummary}`;
        return fallbackSummary;
    }
    async resolvePromptTemplate(tenantId, moduleName, promptKey) {
        return (await this.aiGovernanceService?.resolvePromptVersion({
            tenantId,
            moduleName,
            promptKey,
            fallbackVersion: this.promptVersion,
        }))?.promptText ?? null;
    }
};
exports.CommandCenterService = CommandCenterService;
exports.CommandCenterService = CommandCenterService = CommandCenterService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(7, (0, common_1.Optional)()),
    __param(8, (0, common_1.Optional)()),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        ai_insights_service_1.AiInsightsService,
        revenue_insights_service_1.RevenueInsightsService,
        recommendation_service_1.RecommendationService,
        ai_actions_service_1.AiActionsService,
        ai_service_1.AiService,
        ai_monitoring_service_1.AiMonitoringService,
        ai_governance_service_1.AiGovernanceService,
        knowledge_retrieval_service_1.KnowledgeRetrievalService])
], CommandCenterService);
//# sourceMappingURL=command-center.service.js.map