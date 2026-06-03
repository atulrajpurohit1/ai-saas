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
var AiExecutiveCenterService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiExecutiveCenterService = void 0;
const common_1 = require("@nestjs/common");
const command_center_service_1 = require("../ai-command-center/command-center.service");
const ai_service_1 = require("../ai/ai.service");
const audit_service_1 = require("../audit/audit.service");
const ai_insights_service_1 = require("../ai-insights/ai-insights.service");
const revenue_insights_service_1 = require("../ai-insights/revenue-insights.service");
const ai_monitoring_service_1 = require("../ai-monitoring/ai-monitoring.service");
const prediction_engine_service_1 = require("../ai-predictions/prediction-engine.service");
const knowledge_retrieval_service_1 = require("../knowledge-base/knowledge-retrieval.service");
const PROMPT_VERSION = 'v5-phase-12';
let AiExecutiveCenterService = AiExecutiveCenterService_1 = class AiExecutiveCenterService {
    commandCenterService;
    predictionEngineService;
    revenueInsightsService;
    aiInsightsService;
    aiService;
    aiMonitoringService;
    auditService;
    knowledgeRetrievalService;
    logger = new common_1.Logger(AiExecutiveCenterService_1.name);
    constructor(commandCenterService, predictionEngineService, revenueInsightsService, aiInsightsService, aiService, aiMonitoringService, auditService, knowledgeRetrievalService) {
        this.commandCenterService = commandCenterService;
        this.predictionEngineService = predictionEngineService;
        this.revenueInsightsService = revenueInsightsService;
        this.aiInsightsService = aiInsightsService;
        this.aiService = aiService;
        this.aiMonitoringService = aiMonitoringService;
        this.auditService = auditService;
        this.knowledgeRetrievalService = knowledgeRetrievalService;
    }
    async getDashboard(tenantId, userId) {
        const dashboard = await this.buildDashboard(tenantId, userId);
        await this.auditService.log({
            tenantId,
            userId,
            action: 'AI_EXECUTIVE_DASHBOARD_VIEWED',
            entityType: 'AiExecutiveCenter',
            details: `Business health ${dashboard.businessHealth.status} (${dashboard.businessHealth.score}/100)`,
        });
        await this.auditService.log({
            tenantId,
            userId,
            action: 'AI_EXECUTIVE_SUMMARY_GENERATED',
            entityType: 'AiExecutiveSummary',
            details: dashboard.executiveSummary,
        });
        return dashboard;
    }
    async getSummary(tenantId, userId) {
        const dashboard = await this.buildDashboard(tenantId, userId);
        await this.auditService.log({
            tenantId,
            userId,
            action: 'AI_EXECUTIVE_SUMMARY_GENERATED',
            entityType: 'AiExecutiveSummary',
            details: dashboard.executiveSummary,
        });
        return {
            generatedAt: dashboard.generatedAt,
            source: dashboard.source,
            executiveSummary: dashboard.executiveSummary,
            businessHealth: dashboard.businessHealth,
        };
    }
    async getRisks(tenantId, userId) {
        const dashboard = await this.buildDashboard(tenantId, userId);
        return {
            generatedAt: dashboard.generatedAt,
            risks: dashboard.risks,
            operationsRisk: dashboard.operationsRisk,
            clientRiskValue: dashboard.clientRiskValue,
        };
    }
    async getOpportunities(tenantId, userId) {
        const dashboard = await this.buildDashboard(tenantId, userId);
        return {
            generatedAt: dashboard.generatedAt,
            opportunities: dashboard.opportunities,
            clientRiskValue: dashboard.clientRiskValue,
        };
    }
    async getRecommendations(tenantId, userId) {
        const dashboard = await this.buildDashboard(tenantId, userId);
        await this.auditService.log({
            tenantId,
            userId,
            action: 'AI_EXECUTIVE_RECOMMENDATION_VIEWED',
            entityType: 'AiExecutiveRecommendation',
            details: `${dashboard.recommendations.length} executive recommendations viewed`,
        });
        return {
            generatedAt: dashboard.generatedAt,
            recommendations: dashboard.recommendations,
        };
    }
    async buildDashboard(tenantId, userId) {
        const context = await this.loadContext(tenantId, userId);
        const revenueGrowth = this.buildRevenueGrowth(context);
        const clientRiskValue = this.buildClientRiskValue(context);
        const operationsRisk = this.buildOperationsRisk(context);
        const workforcePerformance = this.buildWorkforcePerformance(context);
        const forecastsPredictions = this.buildForecastsPredictions(context, revenueGrowth);
        const risks = this.buildRiskBoard(context, clientRiskValue, operationsRisk);
        const opportunities = this.buildOpportunityBoard(context, clientRiskValue);
        const businessHealth = this.buildBusinessHealth(context, revenueGrowth, risks);
        const recommendations = this.buildStrategicRecommendations(context, businessHealth, risks, opportunities);
        const generatedSummary = await this.generateExecutiveSummary(context, businessHealth, risks, opportunities, recommendations);
        const source = generatedSummary ? 'ai_assisted' : 'rule_based';
        const executiveSummary = generatedSummary ||
            this.fallbackExecutiveSummary(businessHealth, revenueGrowth, risks, opportunities);
        const dashboard = {
            generatedAt: context.now.toISOString(),
            source,
            executiveSummary,
            businessHealth,
            revenueGrowth,
            clientRiskValue,
            operationsRisk,
            workforcePerformance,
            forecastsPredictions,
            risks,
            opportunities,
            recommendations,
        };
        const generation = await this.aiMonitoringService.logGeneration({
            tenantId,
            createdBy: userId,
            promptVersion: PROMPT_VERSION,
            promptKey: 'executive_summary',
            modelUsed: this.aiService.getModelName(),
            sourceModule: 'ai_executive_center.dashboard',
            generatedOutput: dashboard,
            fallbackUsed: !generatedSummary,
            status: generatedSummary ? 'success' : 'fallback',
        });
        return {
            ...dashboard,
            aiGenerationId: generation?.id,
            recommendations: this.aiMonitoringService.attachGenerationId(recommendations, generation?.id),
        };
    }
    async loadContext(tenantId, userId) {
        const now = new Date();
        const [commandCenter, predictions, revenue, incidentInsights] = await Promise.all([
            this.commandCenterService.getDashboard(tenantId, userId, 'admin'),
            this.predictionEngineService.getDashboard(tenantId, userId),
            this.revenueInsightsService.getRevenueDashboard(tenantId, userId),
            this.aiInsightsService.getIncidentInsights(tenantId, userId),
        ]);
        return {
            tenantId,
            userId,
            now,
            commandCenter,
            predictions,
            revenue,
            incidentInsights,
        };
    }
    buildBusinessHealth(context, revenueGrowth, risks) {
        const highRisks = risks.filter((risk) => ['high', 'critical'].includes(risk.riskLevel)).length;
        const criticalRisks = risks.filter((risk) => risk.riskLevel === 'critical').length;
        const contractRows = context.revenue.contracts.rows;
        const averageContractHealth = this.average(contractRows.map((contract) => contract.healthScore));
        const highChurn = context.predictions.churn.predictions.filter((prediction) => prediction.riskLevel === 'high').length;
        const paymentRisks = context.predictions.payments.predictions.filter((prediction) => prediction.riskLevel === 'high').length;
        const incidentRisks = context.commandCenter.risks.totalCritical * 18 +
            context.commandCenter.risks.totalHighRisk * 8;
        const staffingSlots = context.commandCenter.scheduling.shortageSlots;
        const components = [
            this.healthComponent('revenue', 'Revenue trend', 62 + revenueGrowth.monthlyGrowthRate * 1.8, `${revenueGrowth.monthlyGrowthRate}% monthly growth, ${this.formatCurrency(revenueGrowth.nextMonthRevenue)} next month forecast`),
            this.healthComponent('retention', 'Client retention', 92 - highChurn * 18, `${highChurn} high churn-risk clients`),
            this.healthComponent('incidentRisk', 'Incident risk', 92 - incidentRisks, `${context.commandCenter.risks.totalCritical} critical and ${context.commandCenter.risks.totalHighRisk} high risks`),
            this.healthComponent('staffingCoverage', 'Staffing coverage', 94 - context.commandCenter.scheduling.coverageGaps * 10 - staffingSlots * 4, `${context.commandCenter.scheduling.coverageGaps} coverage gaps, ${staffingSlots} open guard slots`),
            this.healthComponent('paymentStatus', 'Payment status', 92 - paymentRisks * 16 - Math.min(28, revenueGrowth.outstandingAmount / 1000), `${paymentRisks} high payment-risk clients, ${this.formatCurrency(revenueGrowth.outstandingAmount)} outstanding`),
            this.healthComponent('contractHealth', 'Contract health', averageContractHealth, `${this.roundNumber(averageContractHealth, 1)}/100 average contract health`),
        ];
        const score = this.roundRiskScore(components.reduce((sum, component) => sum + component.score, 0) /
            components.length -
            criticalRisks * 3 -
            highRisks);
        const status = this.healthStatus(score);
        return {
            score,
            status,
            summary: `Business health is ${status} with ${highRisks} high-priority risks and ${context.commandCenter.overview.activeClients} active clients.`,
            components,
            metrics: [
                this.metric('Business Health', `${score}/100`, status, this.healthTone(status)),
                this.metric('Revenue Growth', `${revenueGrowth.monthlyGrowthRate}%`, 'Monthly forecast trend', revenueGrowth.monthlyGrowthRate >= 0 ? 'positive' : 'warning'),
                this.metric('Risk Items', highRisks, 'High or critical priorities', highRisks > 0 ? 'warning' : 'positive'),
                this.metric('Contract Health', `${this.roundNumber(averageContractHealth, 1)}/100`, 'Average client contract score', averageContractHealth >= 70 ? 'positive' : 'warning'),
            ],
        };
    }
    buildRevenueGrowth(context) {
        const forecast = context.revenue.forecast;
        return {
            monthlyGrowthRate: forecast.monthlyGrowthRate,
            nextMonthRevenue: forecast.nextMonthRevenue,
            quarterlyForecast: forecast.quarterlyForecast,
            annualForecast: forecast.annualForecast,
            expectedCollections: forecast.expectedCollections,
            outstandingAmount: forecast.outstandingAmount,
            confidence: forecast.confidence,
            metrics: [
                this.metric('Next Month', this.formatCurrency(forecast.nextMonthRevenue), 'Revenue forecast', forecast.nextMonthRevenue > 0 ? 'positive' : 'info'),
                this.metric('Monthly Growth', `${forecast.monthlyGrowthRate}%`, 'Recent invoice baseline', forecast.monthlyGrowthRate >= 0 ? 'positive' : 'warning'),
                this.metric('Expected Collections', this.formatCurrency(forecast.expectedCollections), 'Probability weighted', forecast.expectedCollections > 0 ? 'positive' : 'info'),
                this.metric('Outstanding', this.formatCurrency(forecast.outstandingAmount), 'Open invoices', forecast.outstandingAmount > 0 ? 'warning' : 'positive'),
            ],
        };
    }
    buildClientRiskValue(context) {
        const highValueClients = context.revenue.clientValue.rows
            .filter((client) => client.totalRevenue > 0)
            .slice(0, 5)
            .map((client) => ({
            id: `value-client-${client.clientId}`,
            entityType: 'client',
            name: client.name,
            category: 'high_value_client',
            opportunityScore: client.clientValueScore,
            estimatedValue: client.totalRevenue,
            detail: `${client.revenueShare}% revenue share with ${client.growthRate}% growth.`,
            indicators: client.indicators,
            recommendation: `Focus executive relationship management on ${client.name}.`,
            targetEntityId: client.clientId,
        }));
        const atRiskClients = [
            ...context.commandCenter.risks.clients.map((risk) => this.commandRiskToExecutiveRisk(risk, 'client_risk')),
            ...context.predictions.churn.predictions
                .filter((prediction) => prediction.riskScore >= 40)
                .map((prediction) => this.predictionToRisk(prediction, 'client_risk')),
        ]
            .sort((left, right) => right.riskScore - left.riskScore)
            .slice(0, 6);
        return {
            highValueClients,
            atRiskClients,
            metrics: [
                this.metric('High-Value Clients', highValueClients.length, 'Revenue concentration', highValueClients.length > 0 ? 'positive' : 'info'),
                this.metric('At-Risk Clients', atRiskClients.length, 'Risk board', atRiskClients.length > 0 ? 'warning' : 'positive'),
                this.metric('Top Client Value', highValueClients[0] ? `${highValueClients[0].opportunityScore}/100` : 'N/A', highValueClients[0]?.name || 'No revenue data', highValueClients[0] ? 'positive' : 'info'),
                this.metric('Retention Risks', context.predictions.churn.predictions.filter((prediction) => prediction.riskLevel === 'high').length, 'Predictive churn', context.predictions.churn.predictions.some((prediction) => prediction.riskLevel === 'high') ? 'critical' : 'positive'),
            ],
        };
    }
    buildOperationsRisk(context) {
        const highRiskSites = context.commandCenter.risks.sites
            .map((risk) => this.commandRiskToExecutiveRisk(risk, 'site_risk'))
            .slice(0, 6);
        const staffingRisks = context.predictions.staffing.predictions
            .filter((prediction) => prediction.riskScore >= 25)
            .map((prediction) => this.predictionToRisk(prediction, 'site_risk'))
            .slice(0, 6);
        const incidentRisks = context.predictions.incidents.predictions
            .filter((prediction) => prediction.riskScore >= 25)
            .map((prediction) => this.predictionToRisk(prediction, 'site_risk'))
            .slice(0, 6);
        return {
            highRiskSites,
            staffingRisks,
            incidentRisks,
            metrics: [
                this.metric('High-Risk Sites', highRiskSites.length, 'Command center risks', highRiskSites.length > 0 ? 'warning' : 'positive'),
                this.metric('Staffing Risks', staffingRisks.length, 'Predicted coverage issues', staffingRisks.length > 0 ? 'warning' : 'positive'),
                this.metric('Incident Risks', incidentRisks.length, 'Predicted incident pressure', incidentRisks.length > 0 ? 'warning' : 'positive'),
                this.metric('Coverage Gaps', context.commandCenter.scheduling.coverageGaps, `${context.commandCenter.scheduling.shortageSlots} open slots`, context.commandCenter.scheduling.coverageGaps > 0 ? 'critical' : 'positive'),
            ],
        };
    }
    buildWorkforcePerformance(context) {
        const rows = context.commandCenter.workforce.guards
            .map((guard) => {
            const attendance = guard.attendanceRate ?? 85;
            const score = this.roundRiskScore(attendance -
                guard.missedShifts * 12 -
                guard.lateCheckIns * 5 -
                guard.incidentCount * 6);
            const indicators = [
                `${guard.scheduledShifts} scheduled shifts`,
                guard.attendanceRate === null ? 'Attendance history pending' : `${guard.attendanceRate}% attendance`,
                `${guard.missedShifts} missed shifts`,
                `${guard.lateCheckIns} late check-ins`,
                `${guard.incidentCount} incidents`,
            ];
            return {
                guardId: guard.guardId,
                name: guard.name,
                performanceScore: score,
                attendanceRate: guard.attendanceRate,
                missedShifts: guard.missedShifts,
                lateCheckIns: guard.lateCheckIns,
                incidentCount: guard.incidentCount,
                status: score >= 80 ? 'best' : 'watchlist',
                indicators,
            };
        });
        const bestGuards = [...rows]
            .filter((row) => row.performanceScore >= 70)
            .sort((left, right) => right.performanceScore - left.performanceScore)
            .slice(0, 5);
        const watchlistGuards = [...rows]
            .filter((row) => row.performanceScore < 70)
            .sort((left, right) => left.performanceScore - right.performanceScore)
            .slice(0, 5);
        return {
            bestGuards,
            watchlistGuards,
            metrics: [
                this.metric('Total Guards', context.commandCenter.workforce.totalGuards, 'Workforce size', 'info'),
                this.metric('Attendance Rate', context.commandCenter.workforce.overallAttendanceRate === null ? 'N/A' : `${context.commandCenter.workforce.overallAttendanceRate}%`, 'Overall workforce', context.commandCenter.workforce.overallAttendanceRate !== null && context.commandCenter.workforce.overallAttendanceRate >= 90 ? 'positive' : 'warning'),
                this.metric('Best Performers', bestGuards.length, 'Score 70+', bestGuards.length > 0 ? 'positive' : 'info'),
                this.metric('Watchlist', watchlistGuards.length, 'Needs coaching or review', watchlistGuards.length > 0 ? 'warning' : 'positive'),
            ],
        };
    }
    buildForecastsPredictions(context, revenueForecast) {
        const topPredictions = [
            ...context.predictions.staffing.predictions,
            ...context.predictions.incidents.predictions,
            ...context.predictions.churn.predictions,
            ...context.predictions.payments.predictions,
            ...context.predictions.renewals.predictions,
        ]
            .filter((prediction) => prediction.riskScore >= 25)
            .sort((left, right) => right.riskScore - left.riskScore)
            .slice(0, 8);
        return {
            revenueForecast,
            topPredictions,
            metrics: [
                this.metric('Predictions', topPredictions.length, 'Actionable predictive signals', topPredictions.length > 0 ? 'info' : 'positive'),
                this.metric('Highest Probability', topPredictions[0] ? `${topPredictions[0].probability}%` : '0%', topPredictions[0]?.title || 'No elevated prediction', topPredictions[0] && topPredictions[0].probability >= 70 ? 'critical' : 'info'),
                this.metric('Revenue Forecast', this.formatCurrency(revenueForecast.nextMonthRevenue), 'Next month', revenueForecast.nextMonthRevenue > 0 ? 'positive' : 'info'),
                this.metric('Collections', this.formatCurrency(revenueForecast.expectedCollections), 'Expected collection value', revenueForecast.expectedCollections > 0 ? 'positive' : 'info'),
            ],
        };
    }
    buildRiskBoard(context, clientRiskValue, operationsRisk) {
        const guardRisks = context.incidentInsights.guardRisks
            .filter((risk) => risk.riskScore >= 25)
            .map((risk) => ({
            id: `guard-risk-${risk.entityId}`,
            entityType: 'guard',
            name: risk.name,
            category: 'guard_risk',
            riskScore: risk.riskScore,
            riskLevel: risk.riskLevel,
            detail: `${risk.incidentCount} incidents linked to this guard.`,
            indicators: risk.indicators,
            recommendation: `Review guard performance and incident involvement with ${risk.name}.`,
            targetEntityId: risk.entityId,
        }));
        const paymentRisks = context.predictions.payments.predictions
            .filter((prediction) => prediction.riskScore >= 25)
            .map((prediction) => this.predictionToRisk(prediction, 'payment_risk'));
        const renewalRisks = context.predictions.renewals.predictions
            .filter((prediction) => prediction.riskScore >= 25)
            .map((prediction) => this.predictionToRisk(prediction, 'renewal_risk'));
        return [
            ...clientRiskValue.atRiskClients,
            ...operationsRisk.highRiskSites,
            ...operationsRisk.staffingRisks,
            ...operationsRisk.incidentRisks,
            ...guardRisks,
            ...paymentRisks,
            ...renewalRisks,
        ]
            .sort((left, right) => right.riskScore - left.riskScore)
            .slice(0, 12);
    }
    buildOpportunityBoard(context, clientRiskValue) {
        const renewalOpportunities = context.revenue.renewals.rows
            .slice(0, 5)
            .map((renewal) => ({
            id: `renewal-opportunity-${renewal.id}`,
            entityType: 'contract',
            name: renewal.name,
            category: 'renewal_opportunity',
            opportunityScore: renewal.priority === 'high' ? 90 : renewal.priority === 'medium' ? 70 : 55,
            estimatedValue: renewal.estimatedRevenueAtRisk,
            detail: renewal.reason,
            indicators: [
                renewal.type.replace(/_/g, ' '),
                `${this.formatCurrency(renewal.estimatedRevenueAtRisk)} revenue at risk`,
            ],
            recommendation: renewal.recommendation,
            targetEntityId: renewal.clientId,
        }));
        const revenueGrowthOpportunity = {
            id: 'revenue-growth-opportunity',
            entityType: 'revenue',
            name: 'Revenue growth plan',
            category: 'revenue_growth',
            opportunityScore: this.roundRiskScore(55 + Math.max(0, context.revenue.forecast.monthlyGrowthRate) * 2),
            estimatedValue: context.revenue.forecast.quarterlyForecast,
            detail: `${this.formatCurrency(context.revenue.forecast.quarterlyForecast)} quarterly forecast.`,
            indicators: [
                `${context.revenue.forecast.monthlyGrowthRate}% monthly growth`,
                `${context.revenue.forecast.confidence} forecast confidence`,
            ],
            recommendation: 'Prioritize expansion conversations with high-value and high-growth clients.',
        };
        const staffingOptimization = context.predictions.staffing.predictions
            .filter((prediction) => prediction.riskScore >= 25)
            .slice(0, 3)
            .map((prediction) => ({
            id: `staffing-opportunity-${prediction.id}`,
            entityType: 'staffing',
            name: prediction.title,
            category: 'staffing_optimization',
            opportunityScore: prediction.riskScore,
            estimatedValue: null,
            detail: prediction.summary,
            indicators: prediction.supportingData.map((item) => `${item.label}: ${item.value}`),
            recommendation: prediction.recommendations[0] || 'Improve guard availability coverage.',
            targetEntityId: prediction.entityId,
        }));
        return [
            ...clientRiskValue.highValueClients,
            ...renewalOpportunities,
            revenueGrowthOpportunity,
            ...staffingOptimization,
        ]
            .sort((left, right) => right.opportunityScore - left.opportunityScore)
            .slice(0, 12);
    }
    buildStrategicRecommendations(context, health, risks, opportunities) {
        const recommendations = [];
        const topClient = opportunities.find((opportunity) => opportunity.category === 'high_value_client');
        const paymentRisk = risks.find((risk) => risk.category === 'payment_risk');
        const siteRisk = risks.find((risk) => risk.category === 'site_risk');
        const contractRisk = risks.find((risk) => risk.category === 'renewal_risk' || risk.entityType === 'contract');
        const staffingRisk = context.predictions.staffing.predictions.find((prediction) => prediction.riskScore >= 40);
        const guardRisk = risks.find((risk) => risk.category === 'guard_risk');
        if (topClient) {
            recommendations.push({
                id: 'executive-focus-high-value-client',
                category: 'clients',
                priority: topClient.opportunityScore >= 80 ? 'high' : 'medium',
                title: 'Focus on high-value clients',
                action: topClient.recommendation,
                reason: topClient.detail,
                source: 'rule',
                actionType: 'flag_client_risk',
                targetModule: 'client',
                targetEntityId: topClient.targetEntityId,
            });
        }
        if (paymentRisk) {
            recommendations.push({
                id: 'executive-follow-up-overdue-accounts',
                category: 'billing',
                priority: paymentRisk.riskLevel === 'critical' || paymentRisk.riskLevel === 'high' ? 'high' : 'medium',
                title: 'Follow up with overdue accounts',
                action: paymentRisk.recommendation,
                reason: paymentRisk.detail,
                source: 'rule',
                actionType: 'create_invoice_followup',
                targetModule: 'client',
                targetEntityId: paymentRisk.targetEntityId,
            });
        }
        if (siteRisk) {
            recommendations.push({
                id: 'executive-increase-risky-site-staffing',
                category: 'sites',
                priority: siteRisk.riskLevel === 'critical' || siteRisk.riskLevel === 'high' ? 'high' : 'medium',
                title: 'Increase staffing at risky sites',
                action: siteRisk.recommendation,
                reason: siteRisk.detail,
                source: 'rule',
                actionType: 'flag_site_risk',
                targetModule: 'site',
                targetEntityId: siteRisk.targetEntityId,
            });
        }
        if (contractRisk) {
            recommendations.push({
                id: 'executive-review-low-performing-contracts',
                category: 'contracts',
                priority: contractRisk.riskLevel === 'critical' || contractRisk.riskLevel === 'high' ? 'high' : 'medium',
                title: 'Review low-performing contracts',
                action: contractRisk.recommendation,
                reason: contractRisk.detail,
                source: 'rule',
                actionType: 'flag_client_risk',
                targetModule: 'client',
                targetEntityId: contractRisk.targetEntityId,
            });
        }
        const renewalOpportunity = opportunities.find((opportunity) => opportunity.category === 'renewal_opportunity');
        if (renewalOpportunity) {
            recommendations.push({
                id: 'executive-prepare-renewal-outreach',
                category: 'renewals',
                priority: renewalOpportunity.opportunityScore >= 80 ? 'high' : 'medium',
                title: 'Prepare renewal outreach',
                action: renewalOpportunity.recommendation,
                reason: renewalOpportunity.detail,
                source: 'rule',
                actionType: 'create_follow_up_task',
                targetModule: 'client',
                targetEntityId: renewalOpportunity.targetEntityId,
            });
        }
        if (staffingRisk) {
            recommendations.push({
                id: 'executive-improve-guard-availability',
                category: 'operations',
                priority: staffingRisk.riskLevel === 'high' ? 'high' : 'medium',
                title: 'Improve guard availability coverage',
                action: staffingRisk.recommendations[0] || 'Review guard availability and backup coverage.',
                reason: staffingRisk.explanation,
                source: 'rule',
                actionType: 'suggest_guard_reassignment',
                targetModule: staffingRisk.entityType === 'site' ? 'site' : 'operations',
                targetEntityId: staffingRisk.entityId,
            });
        }
        if (guardRisk) {
            recommendations.push({
                id: 'executive-review-workforce-watchlist',
                category: 'guards',
                priority: guardRisk.riskLevel === 'critical' || guardRisk.riskLevel === 'high' ? 'high' : 'medium',
                title: 'Review workforce performance watchlist',
                action: guardRisk.recommendation,
                reason: guardRisk.detail,
                source: 'rule',
                actionType: 'suggest_guard_reassignment',
                targetModule: 'guard',
                targetEntityId: guardRisk.targetEntityId,
            });
        }
        if (recommendations.length === 0) {
            recommendations.push({
                id: 'executive-maintain-strategic-cadence',
                category: 'operations',
                priority: health.status === 'Excellent' ? 'low' : 'medium',
                title: 'Maintain executive operating cadence',
                action: 'Review business health, risk board, opportunities, and AI actions weekly.',
                reason: `Business health is currently ${health.status}.`,
                source: 'rule',
                actionType: 'create_follow_up_task',
                targetModule: 'operations',
            });
        }
        return recommendations.slice(0, 8);
    }
    async generateExecutiveSummary(context, health, risks, opportunities, recommendations) {
        try {
            const memory = await this.knowledgeRetrievalService?.retrieveRelevant({
                tenantId: context.tenantId,
                userId: context.userId,
                sourceModule: 'ai_executive_center.dashboard',
                categories: [
                    'operations',
                    'staffing',
                    'incidents',
                    'billing',
                    'contracts',
                    'client_management',
                ],
                query: [
                    health.summary,
                    ...risks.slice(0, 5).map((risk) => `${risk.name} ${risk.detail}`),
                    ...opportunities.slice(0, 5).map((opportunity) => `${opportunity.name} ${opportunity.detail}`),
                    ...recommendations.slice(0, 5).map((recommendation) => recommendation.action),
                ].join(' '),
                limit: 6,
            });
            return await this.aiService.generateIncidentRiskSummary(JSON.stringify({
                businessHealth: health,
                revenueGrowth: context.revenue.forecast.monthlyGrowthRate,
                activeClients: context.commandCenter.overview.activeClients,
                topRisks: risks.slice(0, 6),
                topOpportunities: opportunities.slice(0, 6),
                recommendations: recommendations.map((recommendation) => recommendation.action),
                organizationalMemory: memory?.map((entry) => ({
                    title: entry.title,
                    category: entry.category,
                    summary: entry.summary,
                    tags: entry.tags,
                })) || [],
                instruction: 'Write one concise executive summary for a business owner. Mention overall business health, growth, key risks, and next leadership actions.',
            }), null);
        }
        catch (error) {
            this.logger.warn(`Executive AI summary skipped: ${error instanceof Error ? error.message : String(error)}`);
            return null;
        }
    }
    fallbackExecutiveSummary(health, revenue, risks, opportunities) {
        const paymentRisks = risks.filter((risk) => risk.category === 'payment_risk').length;
        const siteRisk = risks.find((risk) => risk.category === 'site_risk');
        const topOpportunity = opportunities[0];
        return [
            `Overall business health is ${health.status}.`,
            `Revenue trend is ${revenue.monthlyGrowthRate >= 0 ? 'growing' : 'declining'} at ${revenue.monthlyGrowthRate}% month over month.`,
            paymentRisks > 0 ? `${paymentRisks} clients show payment delay risk.` : null,
            siteRisk ? `${siteRisk.name} has repeated operational risk signals.` : null,
            topOpportunity ? `Top opportunity: ${topOpportunity.recommendation}` : null,
        ]
            .filter(Boolean)
            .join(' ');
    }
    commandRiskToExecutiveRisk(risk, category) {
        return {
            id: `command-${category}-${risk.id}`,
            entityType: risk.entityType === 'contract' ? 'contract' : risk.entityType,
            name: risk.name,
            category,
            riskScore: risk.riskScore,
            riskLevel: risk.riskLevel,
            detail: `${risk.incidentCount} incidents and risk score ${risk.riskScore}.`,
            indicators: risk.indicators,
            recommendation: risk.entityType === 'site'
                ? `Increase supervision and staffing review for ${risk.name}.`
                : `Review risk controls and service plan for ${risk.name}.`,
            targetEntityId: risk.id,
        };
    }
    predictionToRisk(prediction, category) {
        return {
            id: `prediction-${category}-${prediction.id}`,
            entityType: category === 'payment_risk'
                ? 'invoice'
                : category === 'renewal_risk'
                    ? 'contract'
                    : prediction.entityType === 'pattern' || prediction.entityType === 'shift'
                        ? 'site'
                        : prediction.entityType,
            name: prediction.title,
            category,
            riskScore: prediction.riskScore,
            riskLevel: this.predictionRiskLevel(prediction.riskLevel),
            detail: prediction.summary,
            indicators: prediction.supportingData.map((item) => `${item.label}: ${item.value}`),
            recommendation: prediction.recommendations[0] || 'Review this risk with leadership.',
            targetEntityId: prediction.entityId,
        };
    }
    healthComponent(key, label, rawScore, detail) {
        const score = this.roundRiskScore(rawScore);
        return {
            key,
            label,
            score,
            status: this.healthStatus(score),
            detail,
        };
    }
    predictionRiskLevel(riskLevel) {
        if (riskLevel === 'high')
            return 'high';
        if (riskLevel === 'medium')
            return 'medium';
        return 'low';
    }
    healthStatus(score) {
        if (score >= 85)
            return 'Excellent';
        if (score >= 70)
            return 'Good';
        if (score >= 50)
            return 'Warning';
        return 'Critical';
    }
    healthTone(status) {
        if (status === 'Excellent' || status === 'Good')
            return 'positive';
        if (status === 'Warning')
            return 'warning';
        return 'critical';
    }
    average(values) {
        if (values.length === 0)
            return 70;
        return values.reduce((sum, value) => sum + value, 0) / values.length;
    }
    roundRiskScore(value) {
        return Math.max(0, Math.min(100, Math.round(value)));
    }
    roundNumber(value, decimals) {
        const factor = 10 ** decimals;
        return Math.round(value * factor) / factor;
    }
    metric(label, value, detail, tone) {
        return { label, value, detail, tone };
    }
    formatCurrency(value) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            maximumFractionDigits: value >= 1000 ? 0 : 2,
        }).format(value);
    }
};
exports.AiExecutiveCenterService = AiExecutiveCenterService;
exports.AiExecutiveCenterService = AiExecutiveCenterService = AiExecutiveCenterService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(7, (0, common_1.Optional)()),
    __metadata("design:paramtypes", [command_center_service_1.CommandCenterService,
        prediction_engine_service_1.PredictionEngineService,
        revenue_insights_service_1.RevenueInsightsService,
        ai_insights_service_1.AiInsightsService,
        ai_service_1.AiService,
        ai_monitoring_service_1.AiMonitoringService,
        audit_service_1.AuditService,
        knowledge_retrieval_service_1.KnowledgeRetrievalService])
], AiExecutiveCenterService);
//# sourceMappingURL=ai-executive-center.service.js.map