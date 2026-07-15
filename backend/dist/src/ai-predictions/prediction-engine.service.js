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
var PredictionEngineService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PredictionEngineService = void 0;
const common_1 = require("@nestjs/common");
const ai_actions_service_1 = require("../ai-actions/ai-actions.service");
const ai_service_1 = require("../ai/ai.service");
const audit_service_1 = require("../audit/audit.service");
const ai_insights_service_1 = require("../ai-insights/ai-insights.service");
const recommendation_service_1 = require("../ai-insights/recommendation.service");
const revenue_insights_service_1 = require("../ai-insights/revenue-insights.service");
const ai_monitoring_service_1 = require("../ai-monitoring/ai-monitoring.service");
const prisma_service_1 = require("../prisma/prisma.service");
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const STAFFING_HORIZON_DAYS = 7;
const STAFFING_HISTORY_DAYS = 28;
const INCIDENT_WINDOW_DAYS = 30;
const CONTRACT_RENEWAL_WINDOW_DAYS = 90;
const OUTSTANDING_STATUSES = ['issued', 'resolved', 'disputed'];
const ACTIVE_DISPUTE_STATUSES = ['open', 'under_review'];
const HIGH_INCIDENT_SEVERITIES = ['critical', 'high'];
const PROMPT_VERSION = 'v5-phase-11';
let PredictionEngineService = PredictionEngineService_1 = class PredictionEngineService {
    prisma;
    aiInsightsService;
    revenueInsightsService;
    recommendationService;
    auditService;
    aiMonitoringService;
    aiActionsService;
    aiService;
    logger = new common_1.Logger(PredictionEngineService_1.name);
    constructor(prisma, aiInsightsService, revenueInsightsService, recommendationService, auditService, aiMonitoringService, aiActionsService, aiService) {
        this.prisma = prisma;
        this.aiInsightsService = aiInsightsService;
        this.revenueInsightsService = revenueInsightsService;
        this.recommendationService = recommendationService;
        this.auditService = auditService;
        this.aiMonitoringService = aiMonitoringService;
        this.aiActionsService = aiActionsService;
        this.aiService = aiService;
    }
    async getDashboard(tenantId, userId) {
        const context = await this.loadContext(tenantId, userId);
        const [staffing, incidents, churn, payments, renewals] = [
            this.buildStaffingPredictions(context),
            this.buildIncidentPredictions(context),
            this.buildChurnPredictions(context),
            this.buildPaymentRiskPredictions(context),
            this.buildRenewalRiskPredictions(context),
        ];
        const recommendations = this.buildRecommendations({
            staffing: staffing.predictions,
            incidents: incidents.predictions,
            churn: churn.predictions,
            payments: payments.predictions,
            renewals: renewals.predictions,
        });
        const dashboard = {
            generatedAt: context.now.toISOString(),
            source: 'rule_based',
            summary: this.buildDashboardSummary(staffing, incidents, churn, payments, renewals),
            staffing,
            incidents,
            churn,
            payments,
            renewals,
            recommendations,
            methodology: [
                'Staffing risk blends upcoming shortage slots, guard conflicts, historical coverage gaps, missed attendance, and weekend-night patterns.',
                'Incident risk blends historical incident risk, recent frequency trend, recurring incident type, and high-severity share.',
                'Churn risk blends contract health, retention score, disputes, incidents, revenue decline, outstanding balance, and inactivity.',
                'Payment delay risk blends overdue invoices, late-payment history, active disputes, outstanding balance ratio, and invoice aging.',
                'Renewal risk blends contract health, renewal window urgency, disputes, incidents, outstanding balance, and recent client value trend.',
            ],
        };
        const generation = await this.aiMonitoringService.logGeneration({
            tenantId,
            createdBy: userId,
            promptVersion: PROMPT_VERSION,
            promptKey: 'predictive_operations_dashboard',
            modelUsed: this.aiService.getModelName(),
            sourceModule: 'ai_predictions.dashboard',
            generatedOutput: dashboard,
            fallbackUsed: true,
            status: 'fallback',
        });
        const attachedRecommendations = this.aiMonitoringService.attachGenerationId(dashboard.recommendations, generation?.id);
        await this.auditService.log({
            tenantId,
            userId,
            action: 'AI_PREDICTION_DASHBOARD_VIEWED',
            entityType: 'AiPredictionDashboard',
            details: `${this.totalPredictions(dashboard)} predictions viewed`,
        });
        await this.auditService.log({
            tenantId,
            userId,
            action: 'AI_PREDICTION_GENERATED',
            entityType: 'AiPrediction',
            details: `${this.totalPredictions(dashboard)} predictive operations signals generated`,
        });
        await this.auditService.log({
            tenantId,
            userId,
            action: 'AI_PREDICTION_RECOMMENDATION_CREATED',
            entityType: 'AiPredictionRecommendation',
            details: `${attachedRecommendations.length} predictive recommendations prepared`,
        });
        await this.syncActions(tenantId, userId, attachedRecommendations);
        return {
            ...dashboard,
            aiGenerationId: generation?.id,
            recommendations: attachedRecommendations,
        };
    }
    async loadContext(tenantId, userId) {
        const now = new Date();
        const horizonEnd = this.addDays(now, STAFFING_HORIZON_DAYS);
        const staffingHistoryStart = this.addDays(now, -STAFFING_HISTORY_DAYS);
        const currentIncidentStart = this.addDays(now, -INCIDENT_WINDOW_DAYS);
        const previousIncidentStart = this.addDays(now, -(INCIDENT_WINDOW_DAYS * 2));
        const [opsDashboard, incidentInsights, revenueDashboard, schedulingOverview, upcomingShifts, historicalShifts, availabilities, incidents, invoices, rateCards,] = await Promise.all([
            this.aiInsightsService.getDashboard(tenantId, userId),
            this.aiInsightsService.getIncidentInsights(tenantId, userId),
            this.revenueInsightsService.getRevenueDashboard(tenantId, userId),
            this.recommendationService.getSchedulingOverview(tenantId),
            this.prisma.shift.findMany({
                where: {
                    tenantId,
                    startTime: { gte: now, lt: horizonEnd },
                    status: { not: 'cancelled' },
                },
                select: {
                    id: true,
                    siteId: true,
                    startTime: true,
                    endTime: true,
                    requiredGuards: true,
                    status: true,
                    site: {
                        select: {
                            id: true,
                            name: true,
                            client: {
                                select: {
                                    id: true,
                                    name: true,
                                    companyName: true,
                                },
                            },
                        },
                    },
                    assignments: {
                        select: {
                            guardId: true,
                            guard: {
                                select: {
                                    id: true,
                                    name: true,
                                },
                            },
                        },
                    },
                },
                orderBy: { startTime: 'asc' },
            }),
            this.prisma.shift.findMany({
                where: {
                    tenantId,
                    startTime: { gte: staffingHistoryStart, lt: now },
                    status: { not: 'cancelled' },
                },
                select: {
                    id: true,
                    siteId: true,
                    startTime: true,
                    endTime: true,
                    requiredGuards: true,
                    status: true,
                    assignments: {
                        select: {
                            guardId: true,
                        },
                    },
                    attendanceEvents: {
                        select: {
                            guardId: true,
                            type: true,
                            timestamp: true,
                        },
                    },
                },
            }),
            this.prisma.availability.findMany({
                where: {
                    tenantId,
                    status: 'unavailable',
                    OR: [
                        { startDate: null, endDate: null },
                        { startDate: { lt: horizonEnd }, endDate: null },
                        { startDate: null, endDate: { gt: now } },
                        { startDate: { lt: horizonEnd }, endDate: { gt: now } },
                    ],
                },
                select: {
                    guardId: true,
                    status: true,
                    startDate: true,
                    endDate: true,
                },
            }),
            this.prisma.incident.findMany({
                where: {
                    tenantId,
                    occurredAt: { gte: previousIncidentStart },
                },
                select: {
                    id: true,
                    title: true,
                    description: true,
                    severity: true,
                    occurredAt: true,
                    siteId: true,
                    site: {
                        select: {
                            id: true,
                            name: true,
                            clientId: true,
                        },
                    },
                },
            }),
            this.prisma.invoice.findMany({
                where: { tenantId },
                select: {
                    id: true,
                    clientId: true,
                    invoiceNumber: true,
                    status: true,
                    totalAmount: true,
                    issuedAt: true,
                    paidAt: true,
                    dueDate: true,
                    createdAt: true,
                    client: {
                        select: {
                            id: true,
                            name: true,
                            companyName: true,
                        },
                    },
                    disputes: {
                        select: {
                            status: true,
                            createdAt: true,
                            resolvedAt: true,
                        },
                    },
                },
                orderBy: [{ issuedAt: 'desc' }, { createdAt: 'desc' }],
            }),
            this.prisma.rateCard.findMany({
                where: { tenantId },
                select: {
                    id: true,
                    clientId: true,
                    effectiveTo: true,
                    status: true,
                },
            }),
        ]);
        return {
            tenantId,
            userId,
            now,
            horizonEnd,
            staffingHistoryStart,
            currentIncidentStart,
            previousIncidentStart,
            upcomingShifts: upcomingShifts,
            historicalShifts: historicalShifts,
            availabilities: availabilities,
            incidents: incidents,
            invoices: invoices,
            rateCards: rateCards,
            opsDashboard,
            incidentInsights,
            revenueDashboard,
            schedulingOverview,
        };
    }
    buildStaffingPredictions(context) {
        const siteNames = new Map(context.upcomingShifts.map((shift) => [shift.siteId, shift.site.name]));
        context.historicalShifts.forEach((shift) => {
            if (!siteNames.has(shift.siteId))
                siteNames.set(shift.siteId, 'Known site');
        });
        const predictions = Array.from(siteNames.entries())
            .map(([siteId, siteName]) => this.buildSiteStaffingPrediction(context, siteId, siteName))
            .filter((prediction) => Boolean(prediction))
            .sort((left, right) => right.riskScore - left.riskScore)
            .slice(0, 8);
        const weekendNight = this.buildWeekendNightStaffingPrediction(context);
        const allPredictions = [weekendNight, ...predictions]
            .filter((prediction) => Boolean(prediction))
            .sort((left, right) => right.riskScore - left.riskScore);
        return {
            generatedAt: context.now.toISOString(),
            summary: [
                this.metric('Upcoming shifts', context.upcomingShifts.length, `Next ${STAFFING_HORIZON_DAYS} days`, 'info'),
                this.metric('Coverage gaps', context.schedulingOverview.coverageGaps, `${context.schedulingOverview.shortageSlots} open guard slots`, context.schedulingOverview.coverageGaps > 0 ? 'warning' : 'positive'),
                this.metric('Availability conflicts', this.countAvailabilityConflicts(context), 'Assigned unavailable guards', this.countAvailabilityConflicts(context) > 0 ? 'critical' : 'positive'),
                this.metric('High staffing risks', allPredictions.filter((item) => item.riskLevel === 'high').length, 'Predicted shortages', allPredictions.some((item) => item.riskLevel === 'high') ? 'critical' : 'positive'),
            ],
            predictions: allPredictions.length > 0 ? allPredictions : [this.emptyStaffingPrediction(context)],
        };
    }
    buildSiteStaffingPrediction(context, siteId, siteName) {
        const upcoming = context.upcomingShifts.filter((shift) => shift.siteId === siteId);
        const historical = context.historicalShifts.filter((shift) => shift.siteId === siteId);
        const shortageSlots = upcoming.reduce((sum, shift) => sum + Math.max(0, shift.requiredGuards - shift.assignments.length), 0);
        const affectedShifts = upcoming.filter((shift) => shift.assignments.length < shift.requiredGuards).length;
        const conflictCount = upcoming.reduce((sum, shift) => sum + this.shiftConflictCount(context, shift), 0);
        const historicalCoverageIssues = historical.filter((shift) => shift.assignments.length < shift.requiredGuards).length;
        const assignedPast = historical.reduce((sum, shift) => sum + shift.assignments.length, 0);
        const attendedPast = historical.reduce((sum, shift) => sum +
            shift.assignments.filter((assignment) => shift.attendanceEvents.some((event) => event.guardId === assignment.guardId && event.type === 'CHECK_IN')).length, 0);
        const missedRate = assignedPast > 0 ? (assignedPast - attendedPast) / assignedPast : 0;
        const coverageRate = historical.length > 0 ? historicalCoverageIssues / historical.length : 0;
        const weekendNightUpcoming = upcoming.filter((shift) => this.isWeekendNight(shift.startTime)).length;
        const score = this.roundRiskScore(shortageSlots * 24 +
            conflictCount * 18 +
            coverageRate * 34 +
            missedRate * 22 +
            weekendNightUpcoming * 5);
        if (score < 25 && upcoming.length > 0)
            return null;
        if (upcoming.length === 0 && score < 40)
            return null;
        const confidenceScore = this.confidenceScore(historical.length + upcoming.length, [shortageSlots, conflictCount, historicalCoverageIssues, assignedPast]);
        return {
            id: `staffing-site-${siteId}`,
            category: 'staffing',
            entityType: 'site',
            entityId: siteId,
            title: `${siteName} staffing shortage risk`,
            summary: score >= 70
                ? `${siteName} may experience staffing shortage within ${STAFFING_HORIZON_DAYS} days.`
                : `${siteName} has emerging coverage pressure in the next ${STAFFING_HORIZON_DAYS} days.`,
            riskLevel: this.riskLevel(score),
            riskScore: score,
            probability: score,
            confidenceScore,
            explanation: `${confidenceScore}% confidence due to ${this.joinReasons([
                shortageSlots > 0 ? `${shortageSlots} open guard slots` : null,
                conflictCount > 0 ? `${conflictCount} guard availability conflicts` : null,
                historicalCoverageIssues > 0 ? `${historicalCoverageIssues} historical coverage gaps` : null,
                missedRate > 0 ? `${this.roundPercent(missedRate * 100)}% missed attendance pattern` : null,
            ])}.`,
            supportingData: [
                this.support('Upcoming shifts', upcoming.length, `Next ${STAFFING_HORIZON_DAYS} days`),
                this.support('Shortage slots', shortageSlots),
                this.support('Affected shifts', affectedShifts),
                this.support('Availability conflicts', conflictCount),
                this.support('Historical coverage gaps', historicalCoverageIssues, `Last ${STAFFING_HISTORY_DAYS} days`),
            ],
            recommendations: [
                shortageSlots > 0 ? `Assign ${shortageSlots} additional guard slot${shortageSlots === 1 ? '' : 's'} for ${siteName}.` : `Pre-confirm backup guards for ${siteName}.`,
                conflictCount > 0 ? 'Resolve guard availability conflicts before publishing final roster.' : 'Keep daily shift coverage review active.',
            ],
            timeframe: `Next ${STAFFING_HORIZON_DAYS} days`,
            shortageSlots,
            affectedShifts,
            conflictCount,
        };
    }
    buildWeekendNightStaffingPrediction(context) {
        const weekendNightHistory = context.historicalShifts.filter((shift) => this.isWeekendNight(shift.startTime));
        const otherHistory = context.historicalShifts.filter((shift) => !this.isWeekendNight(shift.startTime));
        const weekendIssueRate = this.coverageIssueRate(weekendNightHistory);
        const otherIssueRate = this.coverageIssueRate(otherHistory);
        const upcomingWeekendNight = context.upcomingShifts.filter((shift) => this.isWeekendNight(shift.startTime));
        const riskIncrease = otherIssueRate > 0
            ? this.roundPercent(((weekendIssueRate - otherIssueRate) / otherIssueRate) * 100)
            : weekendIssueRate > 0
                ? 100
                : 0;
        const shortageSlots = upcomingWeekendNight.reduce((sum, shift) => sum + Math.max(0, shift.requiredGuards - shift.assignments.length), 0);
        const score = this.roundRiskScore(weekendIssueRate * 70 + shortageSlots * 12 + Math.max(0, riskIncrease) * 0.2);
        if (score < 30 || upcomingWeekendNight.length === 0)
            return null;
        return {
            id: 'staffing-pattern-weekend-night',
            category: 'staffing',
            entityType: 'pattern',
            entityId: null,
            title: 'Weekend night coverage gap risk',
            summary: `Weekend night shifts have ${Math.max(0, riskIncrease)}% higher risk of coverage gaps.`,
            riskLevel: this.riskLevel(score),
            riskScore: score,
            probability: score,
            confidenceScore: this.confidenceScore(weekendNightHistory.length + otherHistory.length, [
                weekendNightHistory.length,
                upcomingWeekendNight.length,
            ]),
            explanation: `${this.confidenceScore(weekendNightHistory.length + otherHistory.length, [
                weekendNightHistory.length,
                upcomingWeekendNight.length,
            ])}% confidence due to repeated weekend night staffing pressure in historical shifts.`,
            supportingData: [
                this.support('Weekend night shifts', upcomingWeekendNight.length, `Next ${STAFFING_HORIZON_DAYS} days`),
                this.support('Weekend gap rate', `${this.roundPercent(weekendIssueRate * 100)}%`),
                this.support('Other shift gap rate', `${this.roundPercent(otherIssueRate * 100)}%`),
                this.support('Open weekend slots', shortageSlots),
            ],
            recommendations: [
                'Assign standby guards before the weekend night window.',
                'Review guards with strong night-shift attendance history.',
            ],
            timeframe: `Next ${STAFFING_HORIZON_DAYS} days`,
            shortageSlots,
            affectedShifts: upcomingWeekendNight.length,
            conflictCount: upcomingWeekendNight.reduce((sum, shift) => sum + this.shiftConflictCount(context, shift), 0),
        };
    }
    buildIncidentPredictions(context) {
        const currentIncidents = context.incidents.filter((incident) => incident.occurredAt >= context.currentIncidentStart);
        const previousIncidents = context.incidents.filter((incident) => incident.occurredAt >= context.previousIncidentStart &&
            incident.occurredAt < context.currentIncidentStart);
        const previousBySite = this.countBy(previousIncidents, (incident) => incident.siteId);
        const currentBySite = this.countBy(currentIncidents, (incident) => incident.siteId);
        const predictions = context.incidentInsights.highRiskSites
            .map((risk) => {
            const currentCount = currentBySite.get(risk.entityId) || 0;
            const previousCount = previousBySite.get(risk.entityId) || 0;
            const siteIncidents = context.incidents.filter((incident) => incident.siteId === risk.entityId);
            const highSeverityCount = siteIncidents.filter((incident) => HIGH_INCIDENT_SEVERITIES.includes(incident.severity.toLowerCase())).length;
            const highSeverityRate = siteIncidents.length > 0 ? highSeverityCount / siteIncidents.length : 0;
            const trendLift = previousCount > 0
                ? (currentCount - previousCount) / previousCount
                : currentCount > 0
                    ? 0.5
                    : 0;
            const score = this.roundRiskScore(risk.riskScore * 0.65 + Math.max(0, trendLift) * 20 + highSeverityRate * 25);
            const escalationProbability = this.roundRiskScore(highSeverityRate * 70 + risk.recent7DayCount * 10 + Math.max(0, trendLift) * 20);
            return {
                id: `incident-site-${risk.entityId}`,
                category: 'incidents',
                entityType: 'site',
                entityId: risk.entityId,
                title: `${risk.name} incident risk`,
                summary: score >= 70
                    ? `${risk.name} has elevated incident risk this week.`
                    : `${risk.name} has a moderate recurring incident pattern.`,
                riskLevel: this.riskLevel(score),
                riskScore: score,
                probability: score,
                confidenceScore: this.confidenceScore(siteIncidents.length, [
                    currentCount,
                    previousCount,
                    highSeverityCount,
                ]),
                explanation: `${this.confidenceScore(siteIncidents.length, [
                    currentCount,
                    previousCount,
                    highSeverityCount,
                ])}% confidence due to ${this.joinReasons([
                    `${siteIncidents.length} incidents in the analysis window`,
                    risk.repeatedIncidentTypes > 0 ? 'recurring incident categories' : null,
                    highSeverityCount > 0 ? `${highSeverityCount} high-severity incidents` : null,
                ])}.`,
                supportingData: [
                    this.support('Current 30 days', currentCount),
                    this.support('Previous 30 days', previousCount),
                    this.support('High severity', highSeverityCount),
                    this.support('Existing risk score', risk.riskScore),
                    this.support('Indicators', risk.indicators.join(', ') || 'None'),
                ],
                recommendations: [
                    `Increase supervision or patrol frequency at ${risk.name}.`,
                    'Review incident post orders and recurring location controls.',
                ],
                timeframe: 'Next 7 days',
                expectedTrend: trendLift > 0.1 ? 'increasing' : trendLift < -0.1 ? 'decreasing' : 'stable',
                escalationProbability,
            };
        })
            .filter((prediction) => prediction.riskScore >= 25)
            .sort((left, right) => right.riskScore - left.riskScore)
            .slice(0, 8);
        const typeTrend = this.buildIncidentTypeTrendPrediction(context);
        const allPredictions = [typeTrend, ...predictions]
            .filter((prediction) => Boolean(prediction))
            .sort((left, right) => right.riskScore - left.riskScore);
        return {
            generatedAt: context.now.toISOString(),
            summary: [
                this.metric('Incidents analyzed', context.incidents.length, `Last ${INCIDENT_WINDOW_DAYS * 2} days`, context.incidents.length > 0 ? 'info' : 'positive'),
                this.metric('Current incidents', currentIncidents.length, 'Last 30 days', currentIncidents.length > previousIncidents.length ? 'warning' : 'positive'),
                this.metric('High-risk sites', predictions.filter((item) => item.riskLevel === 'high').length, 'Predicted site risk', predictions.some((item) => item.riskLevel === 'high') ? 'critical' : 'positive'),
                this.metric('Escalation risk', `${Math.max(0, ...predictions.map((item) => item.escalationProbability))}%`, 'Highest predicted escalation', predictions.some((item) => item.escalationProbability >= 70) ? 'critical' : 'info'),
            ],
            predictions: allPredictions.length > 0 ? allPredictions : [this.emptyIncidentPrediction(context)],
        };
    }
    buildIncidentTypeTrendPrediction(context) {
        const currentIncidents = context.incidents.filter((incident) => incident.occurredAt >= context.currentIncidentStart);
        const previousIncidents = context.incidents.filter((incident) => incident.occurredAt >= context.previousIncidentStart &&
            incident.occurredAt < context.currentIncidentStart);
        const currentByType = this.countBy(currentIncidents, (incident) => this.incidentType(incident.title, incident.description));
        const previousByType = this.countBy(previousIncidents, (incident) => this.incidentType(incident.title, incident.description));
        const trend = Array.from(currentByType.entries())
            .map(([type, current]) => {
            const previous = previousByType.get(type) || 0;
            const increase = previous > 0 ? ((current - previous) / previous) * 100 : current > 1 ? 100 : 0;
            return { type, current, previous, increase };
        })
            .filter((item) => item.current > 0 && item.increase > 0)
            .sort((left, right) => right.increase - left.increase || right.current - left.current)[0];
        if (!trend)
            return null;
        const score = this.roundRiskScore(35 + trend.current * 8 + Math.min(35, trend.increase * 0.35));
        return {
            id: `incident-type-${this.slug(trend.type)}`,
            category: 'incidents',
            entityType: 'pattern',
            entityId: null,
            title: `${trend.type} incident trend`,
            summary: `${trend.type} incidents increased ${this.roundPercent(trend.increase)}% over the previous month.`,
            riskLevel: this.riskLevel(score),
            riskScore: score,
            probability: score,
            confidenceScore: this.confidenceScore(trend.current + trend.previous, [
                trend.current,
                trend.previous,
            ]),
            explanation: `${this.confidenceScore(trend.current + trend.previous, [
                trend.current,
                trend.previous,
            ])}% confidence from a month-over-month incident frequency increase.`,
            supportingData: [
                this.support('Incident type', trend.type),
                this.support('Current 30 days', trend.current),
                this.support('Previous 30 days', trend.previous),
                this.support('Increase', `${this.roundPercent(trend.increase)}%`),
            ],
            recommendations: [
                `Investigate repeated ${trend.type.toLowerCase()} incidents.`,
                'Adjust site instructions and escalation checklist for this incident class.',
            ],
            timeframe: 'Next 30 days',
            expectedTrend: 'increasing',
            escalationProbability: this.roundRiskScore(score * 0.7),
        };
    }
    buildChurnPredictions(context) {
        const valueByClient = new Map(context.revenueDashboard.clientValue.rows.map((row) => [row.clientId, row]));
        const predictions = context.revenueDashboard.contracts.rows
            .map((contract) => {
            const value = valueByClient.get(contract.clientId);
            const inactivePenalty = contract.lastInvoiceAt && this.daysSince(new Date(contract.lastInvoiceAt), context.now) > 90 ? 12 : 0;
            const revenueDecline = value ? Math.max(0, -value.growthRate) : 0;
            const score = this.roundRiskScore((100 - contract.healthScore) * 0.4 +
                (value ? (100 - value.retentionScore) * 0.25 : 15) +
                Math.min(18, contract.disputeCount * 6) +
                Math.min(14, contract.incidentCount * 3) +
                Math.min(16, revenueDecline * 0.35) +
                (contract.outstandingAmount > 0 ? 8 : 0) +
                inactivePenalty);
            return {
                id: `churn-client-${contract.clientId}`,
                category: 'churn',
                entityType: 'client',
                entityId: contract.clientId,
                title: `${contract.name} churn risk`,
                summary: score >= 70
                    ? `${contract.name} has elevated churn risk.`
                    : `${contract.name} has moderate retention pressure.`,
                riskLevel: this.riskLevel(score),
                riskScore: score,
                probability: score,
                confidenceScore: this.confidenceScore(contract.invoiceCount + contract.incidentCount + contract.disputeCount, [
                    contract.invoiceCount,
                    contract.incidentCount,
                    contract.disputeCount,
                ]),
                explanation: `${this.confidenceScore(contract.invoiceCount + contract.incidentCount + contract.disputeCount, [
                    contract.invoiceCount,
                    contract.incidentCount,
                    contract.disputeCount,
                ])}% confidence due to contract health, disputes, incident history, and billing behavior.`,
                supportingData: [
                    this.support('Churn score', this.riskLabel(score)),
                    this.support('Contract health', `${contract.healthScore}/100`),
                    this.support('Retention score', value ? `${value.retentionScore}/100` : 'N/A'),
                    this.support('Revenue growth', value ? `${value.growthRate}%` : 'N/A'),
                    this.support('Disputes', contract.disputeCount),
                    this.support('Incidents', contract.incidentCount),
                    this.support('Outstanding', this.formatCurrency(contract.outstandingAmount)),
                ],
                recommendations: [
                    `Contact ${contract.name} to review service satisfaction and upcoming needs.`,
                    'Create a retention follow-up with incident and billing context attached.',
                ],
                timeframe: 'Next 30 days',
                churnScore: this.riskLevel(score),
            };
        })
            .filter((prediction) => prediction.riskScore >= 25)
            .sort((left, right) => right.riskScore - left.riskScore)
            .slice(0, 8);
        return {
            generatedAt: context.now.toISOString(),
            summary: [
                this.metric('Clients analyzed', context.revenueDashboard.contracts.rows.length, 'Contract and billing history', 'info'),
                this.metric('High churn risk', predictions.filter((item) => item.riskLevel === 'high').length, 'Client churn score High', predictions.some((item) => item.riskLevel === 'high') ? 'critical' : 'positive'),
                this.metric('Medium churn risk', predictions.filter((item) => item.riskLevel === 'medium').length, 'Client churn score Medium', predictions.some((item) => item.riskLevel === 'medium') ? 'warning' : 'positive'),
                this.metric('At-risk revenue', this.formatCurrency(this.revenueAtRisk(predictions, context.revenueDashboard.contracts.rows)), 'Estimated from total revenue', predictions.length > 0 ? 'warning' : 'positive'),
            ],
            predictions: predictions.length > 0 ? predictions : [this.emptyChurnPrediction(context)],
        };
    }
    buildPaymentRiskPredictions(context) {
        const invoicesByClient = this.groupBy(context.invoices, (invoice) => invoice.clientId);
        const predictions = Array.from(invoicesByClient.entries())
            .map(([clientId, invoices]) => {
            const client = invoices[0]?.client;
            const outstanding = invoices.filter((invoice) => OUTSTANDING_STATUSES.includes(invoice.status));
            const paid = invoices.filter((invoice) => invoice.status === 'paid' && invoice.paidAt);
            const overdue = outstanding.filter((invoice) => this.daysPastDue(invoice, context.now) > 0);
            const activeDisputes = invoices.reduce((sum, invoice) => sum + invoice.disputes.filter((dispute) => ACTIVE_DISPUTE_STATUSES.includes(dispute.status)).length, 0);
            const latePaid = paid.filter((invoice) => invoice.dueDate && invoice.paidAt && invoice.paidAt > invoice.dueDate);
            const totalBilled = invoices.reduce((sum, invoice) => sum + invoice.totalAmount, 0);
            const outstandingAmount = outstanding.reduce((sum, invoice) => sum + invoice.totalAmount, 0);
            const overdueRate = outstanding.length > 0 ? overdue.length / outstanding.length : 0;
            const latePaidRate = paid.length > 0 ? latePaid.length / paid.length : 0;
            const outstandingRatio = totalBilled > 0 ? outstandingAmount / totalBilled : 0;
            const maxDaysPastDue = Math.max(0, ...outstanding.map((invoice) => this.daysPastDue(invoice, context.now)));
            const probability = this.roundRiskScore(12 +
                overdueRate * 35 +
                latePaidRate * 24 +
                Math.min(22, outstandingRatio * 60) +
                Math.min(18, activeDisputes * 8) +
                Math.min(16, maxDaysPastDue * 0.35));
            return {
                id: `payment-client-${clientId}`,
                category: 'payment',
                entityType: 'client',
                entityId: clientId,
                title: `${this.clientDisplayName(client)} payment delay risk`,
                summary: `${this.clientDisplayName(client)} has ${probability}% probability of delayed payment.`,
                riskLevel: this.riskLevel(probability),
                riskScore: probability,
                probability,
                confidenceScore: this.confidenceScore(invoices.length, [
                    paid.length,
                    outstanding.length,
                    overdue.length,
                ]),
                explanation: `${this.confidenceScore(invoices.length, [
                    paid.length,
                    outstanding.length,
                    overdue.length,
                ])}% confidence due to invoice aging, historical late payments, disputes, and outstanding balances.`,
                supportingData: [
                    this.support('Payment risk score', this.riskLabel(probability)),
                    this.support('Outstanding', this.formatCurrency(outstandingAmount)),
                    this.support('Overdue invoices', overdue.length),
                    this.support('Late paid history', `${this.roundPercent(latePaidRate * 100)}%`),
                    this.support('Active disputes', activeDisputes),
                    this.support('Max days past due', maxDaysPastDue),
                ],
                recommendations: [
                    `Initiate invoice follow-up with ${this.clientDisplayName(client)}.`,
                    activeDisputes > 0 ? 'Resolve active invoice disputes before the next billing cycle.' : 'Confirm payment timeline before due date.',
                ],
                timeframe: 'Next invoice cycle',
                paymentRiskScore: this.riskLevel(probability),
            };
        })
            .filter((prediction) => prediction.riskScore >= 25)
            .sort((left, right) => right.riskScore - left.riskScore)
            .slice(0, 8);
        return {
            generatedAt: context.now.toISOString(),
            summary: [
                this.metric('Clients analyzed', invoicesByClient.size, 'Invoice payment history', 'info'),
                this.metric('High payment risk', predictions.filter((item) => item.riskLevel === 'high').length, 'Predicted delayed payment', predictions.some((item) => item.riskLevel === 'high') ? 'critical' : 'positive'),
                this.metric('Outstanding balance', this.formatCurrency(context.revenueDashboard.forecast.outstandingAmount), 'Forecasting service output', context.revenueDashboard.forecast.outstandingAmount > 0 ? 'warning' : 'positive'),
                this.metric('Expected collections', this.formatCurrency(context.revenueDashboard.forecast.expectedCollections), 'Probability-weighted', 'info'),
            ],
            predictions: predictions.length > 0 ? predictions : [this.emptyPaymentPrediction(context)],
        };
    }
    buildRenewalRiskPredictions(context) {
        const valueByClient = new Map(context.revenueDashboard.clientValue.rows.map((row) => [row.clientId, row]));
        const renewalByClient = new Map(context.revenueDashboard.renewals.rows.map((row) => [row.clientId, row]));
        const rateCardsByClient = this.groupBy(context.rateCards, (rateCard) => rateCard.clientId);
        const predictions = context.revenueDashboard.contracts.rows
            .map((contract) => {
            const value = valueByClient.get(contract.clientId);
            const renewal = renewalByClient.get(contract.clientId);
            const rateCards = rateCardsByClient.get(contract.clientId) || [];
            const nearestRenewalDate = this.nearestFutureDate(rateCards.map((rateCard) => rateCard.effectiveTo).filter((date) => Boolean(date)), context.now);
            const daysUntilRenewal = contract.daysUntilRenewal ??
                (nearestRenewalDate ? this.daysBetween(context.now, nearestRenewalDate) : null);
            const urgency = daysUntilRenewal === null
                ? 0
                : daysUntilRenewal <= 30
                    ? 24
                    : daysUntilRenewal <= CONTRACT_RENEWAL_WINDOW_DAYS
                        ? 14
                        : 0;
            const decline = value ? Math.max(0, -value.growthRate) : 0;
            const nonRenewalProbability = this.roundRiskScore((100 - contract.healthScore) * 0.45 +
                urgency +
                Math.min(14, contract.disputeCount * 5) +
                Math.min(12, contract.incidentCount * 2.5) +
                (contract.outstandingAmount > 0 ? 8 : 0) +
                Math.min(12, decline * 0.3));
            const contractHealthTrend = this.contractHealthTrend(contract, value?.growthRate ?? 0);
            return {
                id: `renewal-client-${contract.clientId}`,
                category: 'renewal',
                entityType: 'contract',
                entityId: contract.clientId,
                title: `${contract.name} renewal risk`,
                summary: daysUntilRenewal !== null && daysUntilRenewal <= 30
                    ? `${contract.name} likely requires renewal outreach within 30 days.`
                    : `${contract.name} has ${nonRenewalProbability}% non-renewal probability.`,
                riskLevel: this.riskLevel(nonRenewalProbability),
                riskScore: nonRenewalProbability,
                probability: nonRenewalProbability,
                confidenceScore: this.confidenceScore(contract.invoiceCount + rateCards.length, [
                    contract.invoiceCount,
                    rateCards.length,
                    contract.disputeCount,
                ]),
                explanation: `${this.confidenceScore(contract.invoiceCount + rateCards.length, [
                    contract.invoiceCount,
                    rateCards.length,
                    contract.disputeCount,
                ])}% confidence due to contract health, renewal timing, disputes, incidents, and billing trend.`,
                supportingData: [
                    this.support('Non-renewal probability', `${nonRenewalProbability}%`),
                    this.support('Renewal likelihood', `${100 - nonRenewalProbability}%`),
                    this.support('Health trend', contractHealthTrend),
                    this.support('Days until renewal', daysUntilRenewal ?? 'N/A'),
                    this.support('Contract health', `${contract.healthScore}/100`),
                    this.support('Renewal signal', renewal?.reason || 'No explicit renewal opportunity'),
                ],
                recommendations: [
                    `Begin contract renewal process for ${contract.name}.`,
                    nonRenewalProbability >= 70 ? 'Schedule executive outreach and review service quality blockers.' : 'Prepare renewal talking points and updated pricing context.',
                ],
                timeframe: daysUntilRenewal !== null ? `${daysUntilRenewal} days` : `Next ${CONTRACT_RENEWAL_WINDOW_DAYS} days`,
                nonRenewalProbability,
                renewalLikelihood: 100 - nonRenewalProbability,
                contractHealthTrend,
            };
        })
            .filter((prediction) => prediction.riskScore >= 25 ||
            (prediction.supportingData.find((item) => item.label === 'Days until renewal')?.value ?? 9999) !== 'N/A')
            .sort((left, right) => right.riskScore - left.riskScore)
            .slice(0, 8);
        return {
            generatedAt: context.now.toISOString(),
            summary: [
                this.metric('Contracts analyzed', context.revenueDashboard.contracts.rows.length, 'Revenue forecasting service', 'info'),
                this.metric('Renewals due', context.revenueDashboard.renewals.rows.filter((row) => row.type === 'renewal_due').length, `Next ${CONTRACT_RENEWAL_WINDOW_DAYS} days`, context.revenueDashboard.renewals.rows.length > 0 ? 'warning' : 'positive'),
                this.metric('High renewal risk', predictions.filter((item) => item.riskLevel === 'high').length, 'Non-renewal probability High', predictions.some((item) => item.riskLevel === 'high') ? 'critical' : 'positive'),
                this.metric('Declining trend', predictions.filter((item) => item.contractHealthTrend === 'declining').length, 'Contract health trend', predictions.some((item) => item.contractHealthTrend === 'declining') ? 'warning' : 'positive'),
            ],
            predictions: predictions.length > 0 ? predictions : [this.emptyRenewalPrediction(context)],
        };
    }
    buildRecommendations(input) {
        const recommendations = [];
        const staffing = this.firstActionable(input.staffing);
        const incident = this.firstActionable(input.incidents);
        const churn = this.firstActionable(input.churn);
        const payment = this.firstActionable(input.payments);
        const renewal = this.firstActionable(input.renewals);
        if (staffing) {
            recommendations.push(this.toRecommendation(staffing, {
                id: 'prediction-staffing-action',
                category: 'operations',
                title: 'Assign additional guard coverage',
                action: staffing.recommendations[0],
                actionType: 'suggest_guard_reassignment',
                targetModule: staffing.entityType === 'site' ? 'site' : 'operations',
            }));
        }
        if (incident) {
            recommendations.push(this.toRecommendation(incident, {
                id: 'prediction-incident-action',
                category: 'incidents',
                title: 'Reduce predicted incident risk',
                action: incident.recommendations[0],
                actionType: 'flag_site_risk',
                targetModule: incident.entityType === 'site' ? 'site' : 'incident',
            }));
        }
        if (churn) {
            recommendations.push(this.toRecommendation(churn, {
                id: 'prediction-churn-action',
                category: 'clients',
                title: 'Contact at-risk client',
                action: churn.recommendations[0],
                actionType: 'flag_client_risk',
                targetModule: 'client',
            }));
        }
        if (payment) {
            recommendations.push(this.toRecommendation(payment, {
                id: 'prediction-payment-action',
                category: 'billing',
                title: 'Initiate invoice follow-up',
                action: payment.recommendations[0],
                actionType: 'create_invoice_followup',
                targetModule: 'client',
            }));
        }
        if (renewal) {
            recommendations.push(this.toRecommendation(renewal, {
                id: 'prediction-renewal-action',
                category: 'renewals',
                title: 'Begin contract renewal process',
                action: renewal.recommendations[0],
                actionType: 'create_follow_up_task',
                targetModule: 'client',
            }));
        }
        return recommendations.sort((left, right) => this.priorityRank(right.priority) - this.priorityRank(left.priority));
    }
    toRecommendation(prediction, input) {
        return {
            id: input.id,
            category: input.category,
            priority: prediction.riskLevel === 'high' ? 'high' : prediction.riskLevel === 'medium' ? 'medium' : 'low',
            title: input.title,
            action: input.action,
            reason: prediction.explanation,
            source: 'rule',
            confidence: prediction.confidenceScore >= 75
                ? 'high'
                : prediction.confidenceScore >= 55
                    ? 'medium'
                    : 'low',
            actionType: input.actionType,
            targetModule: input.targetModule,
            targetEntityId: prediction.entityId ?? null,
        };
    }
    async syncActions(tenantId, userId, recommendations) {
        if (recommendations.length === 0)
            return;
        try {
            await this.aiActionsService.syncFromRecommendations(tenantId, recommendations, userId);
        }
        catch (error) {
            this.logger.warn(`Prediction actions sync skipped: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    shiftConflictCount(context, shift) {
        return shift.assignments.filter((assignment) => {
            const unavailable = context.availabilities.some((availability) => availability.guardId === assignment.guardId &&
                this.datesOverlap(availability.startDate ?? new Date(0), availability.endDate ?? new Date('9999-12-31T23:59:59.999Z'), shift.startTime, shift.endTime));
            const overlaps = context.upcomingShifts.some((other) => other.id !== shift.id &&
                other.assignments.some((otherAssignment) => otherAssignment.guardId === assignment.guardId) &&
                this.datesOverlap(other.startTime, other.endTime, shift.startTime, shift.endTime));
            return unavailable || overlaps;
        }).length;
    }
    countAvailabilityConflicts(context) {
        return context.upcomingShifts.reduce((sum, shift) => sum + this.shiftConflictCount(context, shift), 0);
    }
    coverageIssueRate(shifts) {
        if (shifts.length === 0)
            return 0;
        return shifts.filter((shift) => shift.assignments.length < shift.requiredGuards).length / shifts.length;
    }
    firstActionable(predictions) {
        return predictions.find((prediction) => prediction.riskScore >= 25);
    }
    buildDashboardSummary(staffing, incidents, churn, payments, renewals) {
        const all = [
            ...staffing.predictions,
            ...incidents.predictions,
            ...churn.predictions,
            ...payments.predictions,
            ...renewals.predictions,
        ];
        const actionable = all.filter((prediction) => prediction.riskScore >= 25);
        const high = actionable.filter((prediction) => prediction.riskLevel === 'high').length;
        const top = actionable.sort((left, right) => right.riskScore - left.riskScore)[0];
        return [
            this.metric('Predictions', actionable.length, 'Actionable signals', actionable.length > 0 ? 'info' : 'positive'),
            this.metric('High risk', high, 'Needs attention', high > 0 ? 'critical' : 'positive'),
            this.metric('Top probability', top ? `${top.probability}%` : '0%', top?.title || 'No elevated risk', top && top.probability >= 70 ? 'critical' : 'info'),
            this.metric('Avg confidence', `${this.average(actionable.map((item) => item.confidenceScore))}%`, 'Across actionable predictions', actionable.length > 0 ? 'info' : 'positive'),
        ];
    }
    emptyStaffingPrediction(context) {
        return {
            id: 'staffing-empty',
            category: 'staffing',
            entityType: 'pattern',
            entityId: null,
            title: 'No elevated staffing shortage predicted',
            summary: 'No elevated staffing shortage is predicted in the next 7 days.',
            riskLevel: 'low',
            riskScore: 10,
            probability: 10,
            confidenceScore: this.confidenceScore(context.historicalShifts.length + context.upcomingShifts.length, [context.upcomingShifts.length]),
            explanation: 'Confidence is based on upcoming shift coverage and recent attendance history.',
            supportingData: [
                this.support('Upcoming shifts', context.upcomingShifts.length),
                this.support('Open slots', context.schedulingOverview.shortageSlots),
            ],
            recommendations: ['Continue daily coverage review.'],
            timeframe: `Next ${STAFFING_HORIZON_DAYS} days`,
            shortageSlots: 0,
            affectedShifts: 0,
            conflictCount: 0,
        };
    }
    emptyIncidentPrediction(context) {
        return {
            id: 'incident-empty',
            category: 'incidents',
            entityType: 'pattern',
            entityId: null,
            title: 'No elevated incident risk predicted',
            summary: 'No elevated incident risk is predicted from current incident trends.',
            riskLevel: 'low',
            riskScore: 10,
            probability: 10,
            confidenceScore: this.confidenceScore(context.incidents.length, [context.incidents.length]),
            explanation: 'Confidence is based on recent and previous incident windows.',
            supportingData: [this.support('Incidents analyzed', context.incidents.length)],
            recommendations: ['Maintain incident review cadence.'],
            timeframe: 'Next 7 days',
            expectedTrend: 'stable',
            escalationProbability: 10,
        };
    }
    emptyChurnPrediction(context) {
        return {
            id: 'churn-empty',
            category: 'churn',
            entityType: 'client',
            entityId: null,
            title: 'No elevated churn risk predicted',
            summary: 'No clients currently have elevated churn risk.',
            riskLevel: 'low',
            riskScore: 10,
            probability: 10,
            confidenceScore: this.confidenceScore(context.revenueDashboard.contracts.rows.length, [context.revenueDashboard.contracts.rows.length]),
            explanation: 'Confidence is based on available contract, incident, dispute, and payment history.',
            supportingData: [this.support('Clients analyzed', context.revenueDashboard.contracts.rows.length)],
            recommendations: ['Continue regular client health reviews.'],
            timeframe: 'Next 30 days',
            churnScore: 'low',
        };
    }
    emptyPaymentPrediction(context) {
        return {
            id: 'payment-empty',
            category: 'payment',
            entityType: 'client',
            entityId: null,
            title: 'No elevated payment delay predicted',
            summary: 'No clients currently have elevated payment delay risk.',
            riskLevel: 'low',
            riskScore: 10,
            probability: 10,
            confidenceScore: this.confidenceScore(context.invoices.length, [context.invoices.length]),
            explanation: 'Confidence is based on invoice aging and payment history.',
            supportingData: [this.support('Invoices analyzed', context.invoices.length)],
            recommendations: ['Continue normal invoice follow-up cadence.'],
            timeframe: 'Next invoice cycle',
            paymentRiskScore: 'low',
        };
    }
    emptyRenewalPrediction(context) {
        return {
            id: 'renewal-empty',
            category: 'renewal',
            entityType: 'contract',
            entityId: null,
            title: 'No elevated renewal risk predicted',
            summary: 'No contracts currently require urgent renewal outreach.',
            riskLevel: 'low',
            riskScore: 10,
            probability: 10,
            confidenceScore: this.confidenceScore(context.rateCards.length, [context.rateCards.length]),
            explanation: 'Confidence is based on contract dates, contract health, and billing history.',
            supportingData: [this.support('Contract records', context.rateCards.length)],
            recommendations: ['Continue regular renewal review.'],
            timeframe: `Next ${CONTRACT_RENEWAL_WINDOW_DAYS} days`,
            nonRenewalProbability: 10,
            renewalLikelihood: 90,
            contractHealthTrend: 'stable',
        };
    }
    revenueAtRisk(predictions, contracts) {
        const contractByClient = new Map(contracts.map((contract) => [contract.clientId, contract]));
        return this.roundCurrency(predictions.reduce((sum, prediction) => {
            if (!prediction.entityId)
                return sum;
            const contract = contractByClient.get(prediction.entityId);
            return sum + (contract ? contract.totalRevenue * (prediction.probability / 100) : 0);
        }, 0));
    }
    contractHealthTrend(contract, growthRate) {
        if (contract.healthScore < 55 || growthRate < -10 || contract.disputeCount >= 2)
            return 'declining';
        if (contract.healthScore >= 80 && growthRate >= 5)
            return 'improving';
        return 'stable';
    }
    incidentType(title, description) {
        const text = `${title || ''} ${description || ''}`.toLowerCase();
        if (/(theft|steal|stolen|burglary|robbery|shoplift)/.test(text))
            return 'Theft';
        if (/(assault|fight|violence|attack|threat|weapon)/.test(text))
            return 'Violence or threat';
        if (/(fire|smoke|burn|alarm)/.test(text))
            return 'Fire or alarm';
        if (/(medical|injury|injured|fall|ambulance|health)/.test(text))
            return 'Medical or injury';
        if (/(unauthorized|access|trespass|intruder|gate|entry)/.test(text))
            return 'Unauthorized access';
        if (/(parking|vehicle|car|traffic|accident)/.test(text))
            return 'Vehicle or parking';
        if (/(equipment|camera|cctv|radio|device|system)/.test(text))
            return 'Equipment issue';
        if (/(shortage|uncovered|coverage|absent|no guard|staff)/.test(text))
            return 'Coverage issue';
        return 'General incident';
    }
    daysPastDue(invoice, now) {
        if (!invoice.dueDate || invoice.status === 'paid')
            return 0;
        return invoice.dueDate < now ? this.daysBetween(invoice.dueDate, now) : 0;
    }
    datesOverlap(firstStart, firstEnd, secondStart, secondEnd) {
        return firstStart < secondEnd && firstEnd > secondStart;
    }
    isWeekendNight(date) {
        const day = date.getUTCDay();
        const hour = date.getUTCHours();
        return (day === 0 || day === 5 || day === 6) && (hour >= 18 || hour < 6);
    }
    riskLevel(score) {
        if (score >= 70)
            return 'high';
        if (score >= 40)
            return 'medium';
        return 'low';
    }
    riskLabel(score) {
        const risk = this.riskLevel(score);
        return risk[0].toUpperCase() + risk.slice(1);
    }
    confidenceScore(sampleSize, signals) {
        const signalStrength = signals.filter((value) => {
            if (typeof value === 'number')
                return value > 0;
            return Boolean(value);
        }).length;
        return this.roundRiskScore(42 + Math.min(35, sampleSize * 2.5) + signalStrength * 6);
    }
    joinReasons(reasons) {
        const filtered = reasons.filter((reason) => Boolean(reason));
        return filtered.length > 0 ? filtered.join(', ') : 'the available operating history';
    }
    addDays(date, days) {
        const next = new Date(date);
        next.setUTCDate(next.getUTCDate() + days);
        return next;
    }
    daysBetween(start, end) {
        return Math.max(0, Math.ceil((end.getTime() - start.getTime()) / MS_PER_DAY));
    }
    daysSince(date, now) {
        return this.daysBetween(date, now);
    }
    nearestFutureDate(dates, now) {
        return dates.filter((date) => date >= now).sort((left, right) => left.getTime() - right.getTime())[0] ?? null;
    }
    groupBy(items, keyFn) {
        const groups = new Map();
        items.forEach((item) => {
            const key = keyFn(item);
            groups.set(key, [...(groups.get(key) || []), item]);
        });
        return groups;
    }
    countBy(items, keyFn) {
        const counts = new Map();
        items.forEach((item) => {
            const key = keyFn(item);
            counts.set(key, (counts.get(key) || 0) + 1);
        });
        return counts;
    }
    clientDisplayName(client) {
        return client?.companyName || client?.name || 'Unknown client';
    }
    metric(label, value, detail, tone) {
        return { label, value, detail, tone };
    }
    support(label, value, detail) {
        return { label, value, detail };
    }
    priorityRank(priority) {
        if (priority === 'high')
            return 3;
        if (priority === 'medium')
            return 2;
        return 1;
    }
    totalPredictions(dashboard) {
        return (dashboard.staffing.predictions.length +
            dashboard.incidents.predictions.length +
            dashboard.churn.predictions.length +
            dashboard.payments.predictions.length +
            dashboard.renewals.predictions.length);
    }
    average(values) {
        if (values.length === 0)
            return 0;
        return this.roundPercent(values.reduce((sum, value) => sum + value, 0) / values.length);
    }
    roundRiskScore(score) {
        return Math.max(0, Math.min(100, Math.round(score)));
    }
    roundPercent(value) {
        return Math.round(value * 10) / 10;
    }
    roundCurrency(value) {
        return Math.round(value * 100) / 100;
    }
    formatCurrency(value) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            maximumFractionDigits: value >= 1000 ? 0 : 2,
        }).format(value);
    }
    slug(value) {
        return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    }
};
exports.PredictionEngineService = PredictionEngineService;
exports.PredictionEngineService = PredictionEngineService = PredictionEngineService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        ai_insights_service_1.AiInsightsService,
        revenue_insights_service_1.RevenueInsightsService,
        recommendation_service_1.RecommendationService,
        audit_service_1.AuditService,
        ai_monitoring_service_1.AiMonitoringService,
        ai_actions_service_1.AiActionsService,
        ai_service_1.AiService])
], PredictionEngineService);
//# sourceMappingURL=prediction-engine.service.js.map