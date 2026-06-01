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
var RevenueInsightsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RevenueInsightsService = void 0;
const common_1 = require("@nestjs/common");
const ai_service_1 = require("../ai/ai.service");
const audit_service_1 = require("../audit/audit.service");
const prisma_service_1 = require("../prisma/prisma.service");
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const FORECAST_MONTHS = 12;
const HISTORY_MONTHS = 12;
const CURRENT_PERIOD_DAYS = 90;
const PREVIOUS_PERIOD_DAYS = 180;
const INCIDENT_LOOKBACK_DAYS = 180;
const RENEWAL_WINDOW_DAYS = 90;
const INACTIVE_CLIENT_DAYS = 90;
const REVENUE_STATUSES = ['issued', 'disputed', 'resolved', 'paid'];
const OUTSTANDING_STATUSES = ['issued', 'resolved', 'disputed'];
const ACTIVE_DISPUTE_STATUSES = ['open', 'under_review'];
const HIGH_INCIDENT_SEVERITIES = ['critical', 'high'];
let RevenueInsightsService = RevenueInsightsService_1 = class RevenueInsightsService {
    prisma;
    aiService;
    auditService;
    logger = new common_1.Logger(RevenueInsightsService_1.name);
    constructor(prisma, aiService, auditService) {
        this.prisma = prisma;
        this.aiService = aiService;
        this.auditService = auditService;
    }
    async getRevenueDashboard(tenantId, userId) {
        const base = await this.buildBaseSections(tenantId);
        const recommendations = await this.buildFinancialRecommendations(base.context, base.forecast, base.clientValue, base.contracts, base.renewals);
        const generatedSummary = await this.buildAiSummary(base.context, base.forecast, base.clientValue, base.contracts, base.renewals, recommendations);
        const aiSummary = generatedSummary ||
            this.fallbackRevenueSummary(base.forecast, base.clientValue, base.contracts, base.renewals, recommendations);
        const source = recommendations.source === 'ai_assisted' || generatedSummary
            ? 'ai_assisted'
            : 'rule_based';
        await Promise.all([
            this.logAudit(tenantId, userId, 'AI_REVENUE_DASHBOARD_VIEWED', 'AiRevenueInsights', 'Revenue dashboard viewed'),
            this.logAudit(tenantId, userId, 'AI_REVENUE_FORECAST_GENERATED', 'AiRevenueForecast', `Next month forecast ${this.formatCurrency(base.forecast.nextMonthRevenue)}`),
            this.logAudit(tenantId, userId, 'AI_CONTRACT_ANALYSIS_EXECUTED', 'AiContractIntelligence', `${base.contracts.rows.length} contracts analyzed`),
            this.logAudit(tenantId, userId, 'AI_FINANCIAL_RECOMMENDATION_GENERATED', 'AiFinancialRecommendation', `${recommendations.recommendations.length} recommendations generated`),
        ]);
        return {
            generatedAt: base.context.now.toISOString(),
            source,
            aiSummary,
            forecast: base.forecast,
            clientValue: base.clientValue,
            contracts: base.contracts,
            renewals: base.renewals,
            recommendations,
        };
    }
    async getContractInsights(tenantId, userId) {
        const base = await this.buildBaseSections(tenantId);
        await this.logAudit(tenantId, userId, 'AI_CONTRACT_ANALYSIS_EXECUTED', 'AiContractIntelligence', `${base.contracts.rows.length} contracts analyzed`);
        return base.contracts;
    }
    async getClientValueAnalysis(tenantId, userId) {
        const base = await this.buildBaseSections(tenantId);
        await this.logAudit(tenantId, userId, 'AI_CLIENT_VALUE_ANALYSIS_VIEWED', 'AiClientValue', `${base.clientValue.rows.length} clients analyzed`);
        return base.clientValue;
    }
    async getRenewalOpportunities(tenantId, userId) {
        const base = await this.buildBaseSections(tenantId);
        await this.logAudit(tenantId, userId, 'AI_RENEWAL_OPPORTUNITIES_VIEWED', 'AiRenewalOpportunity', `${base.renewals.rows.length} renewal opportunities detected`);
        return base.renewals;
    }
    async getFinancialRecommendations(tenantId, userId) {
        const base = await this.buildBaseSections(tenantId);
        const recommendations = await this.buildFinancialRecommendations(base.context, base.forecast, base.clientValue, base.contracts, base.renewals);
        await this.logAudit(tenantId, userId, 'AI_FINANCIAL_RECOMMENDATION_GENERATED', 'AiFinancialRecommendation', `${recommendations.recommendations.length} recommendations generated`);
        return recommendations;
    }
    async buildBaseSections(tenantId) {
        const context = await this.loadContext(tenantId);
        const aggregates = this.buildClientAggregates(context);
        const forecast = this.buildForecast(context);
        const contracts = this.buildContractIntelligence(context, aggregates);
        const clientValue = this.buildClientValueAnalysis(context, aggregates, contracts.rows);
        const renewals = this.buildRenewalOpportunities(context, contracts.rows, clientValue.rows);
        return {
            context,
            aggregates,
            forecast,
            contracts,
            clientValue,
            renewals,
        };
    }
    async loadContext(tenantId) {
        const now = new Date();
        const incidentStart = this.addDays(now, -INCIDENT_LOOKBACK_DAYS);
        const [clients, invoices, rateCards, incidents] = await Promise.all([
            this.prisma.client.findMany({
                where: { tenantId },
                select: {
                    id: true,
                    name: true,
                    companyName: true,
                    createdAt: true,
                    _count: {
                        select: {
                            sites: true,
                            invoices: true,
                            rateCards: true,
                            deals: true,
                            proposals: true,
                        },
                    },
                },
                orderBy: { createdAt: 'asc' },
            }),
            this.prisma.invoice.findMany({
                where: {
                    tenantId,
                    status: { in: REVENUE_STATUSES },
                },
                select: {
                    id: true,
                    clientId: true,
                    siteId: true,
                    invoiceNumber: true,
                    status: true,
                    totalAmount: true,
                    billingStartDate: true,
                    billingEndDate: true,
                    issuedAt: true,
                    paidAt: true,
                    dueDate: true,
                    createdAt: true,
                    client: {
                        select: {
                            name: true,
                            companyName: true,
                        },
                    },
                    site: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                    disputes: {
                        select: {
                            id: true,
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
                    siteId: true,
                    roleName: true,
                    hourlyRate: true,
                    effectiveFrom: true,
                    effectiveTo: true,
                    status: true,
                    createdAt: true,
                    client: {
                        select: {
                            name: true,
                            companyName: true,
                        },
                    },
                    site: {
                        select: {
                            name: true,
                        },
                    },
                },
                orderBy: [{ effectiveFrom: 'desc' }, { createdAt: 'desc' }],
            }),
            this.prisma.incident.findMany({
                where: {
                    tenantId,
                    occurredAt: { gte: incidentStart },
                },
                select: {
                    id: true,
                    severity: true,
                    occurredAt: true,
                    site: {
                        select: {
                            clientId: true,
                        },
                    },
                },
            }),
        ]);
        return {
            tenantId,
            now,
            clients: clients,
            invoices: invoices,
            rateCards: rateCards,
            incidents: incidents,
        };
    }
    buildClientAggregates(context) {
        const currentPeriodStart = this.addDays(context.now, -CURRENT_PERIOD_DAYS);
        const previousPeriodStart = this.addDays(context.now, -PREVIOUS_PERIOD_DAYS);
        const aggregates = new Map();
        context.clients.forEach((client) => {
            aggregates.set(client.id, {
                clientId: client.id,
                name: this.clientDisplayName(client),
                createdAt: client.createdAt,
                siteCount: client._count.sites,
                contractActivity: client._count.deals + client._count.proposals,
                invoiceCount: 0,
                totalRevenue: 0,
                paidAmount: 0,
                outstandingAmount: 0,
                currentPeriodRevenue: 0,
                previousPeriodRevenue: 0,
                disputeCount: 0,
                activeDisputeCount: 0,
                incidentCount: 0,
                highIncidentCount: 0,
                paymentDays: [],
                lastInvoiceAt: null,
                firstActivityAt: client.createdAt,
                activeRateCardCount: 0,
                rateCardCount: client._count.rateCards,
                contractEndDate: null,
                renewalDate: null,
            });
        });
        context.invoices.forEach((invoice) => {
            const aggregate = this.getOrCreateAggregate(aggregates, invoice);
            const invoiceDate = this.invoiceDate(invoice);
            aggregate.invoiceCount += 1;
            aggregate.totalRevenue = this.roundCurrency(aggregate.totalRevenue + invoice.totalAmount);
            aggregate.lastInvoiceAt = this.maxDate(aggregate.lastInvoiceAt, invoiceDate);
            aggregate.firstActivityAt = this.minDate(aggregate.firstActivityAt, invoice.billingStartDate || invoiceDate);
            aggregate.disputeCount += invoice.disputes.length;
            aggregate.activeDisputeCount += invoice.disputes.filter((dispute) => ACTIVE_DISPUTE_STATUSES.includes(dispute.status)).length;
            if (invoiceDate >= currentPeriodStart) {
                aggregate.currentPeriodRevenue = this.roundCurrency(aggregate.currentPeriodRevenue + invoice.totalAmount);
            }
            else if (invoiceDate >= previousPeriodStart) {
                aggregate.previousPeriodRevenue = this.roundCurrency(aggregate.previousPeriodRevenue + invoice.totalAmount);
            }
            if (invoice.status === 'paid') {
                aggregate.paidAmount = this.roundCurrency(aggregate.paidAmount + invoice.totalAmount);
                if (invoice.paidAt) {
                    aggregate.paymentDays.push(this.daysBetween(invoiceDate, invoice.paidAt));
                }
            }
            if (OUTSTANDING_STATUSES.includes(invoice.status)) {
                aggregate.outstandingAmount = this.roundCurrency(aggregate.outstandingAmount + invoice.totalAmount);
            }
        });
        context.rateCards.forEach((rateCard) => {
            const aggregate = this.getOrCreateAggregateForClient(aggregates, rateCard.clientId, rateCard.client ? this.clientDisplayName(rateCard.client) : 'Unknown client', rateCard.createdAt);
            const active = this.isActiveRateCard(rateCard, context.now);
            aggregate.rateCardCount = Math.max(aggregate.rateCardCount, 1);
            aggregate.contractActivity += 1;
            aggregate.firstActivityAt = this.minDate(aggregate.firstActivityAt, rateCard.effectiveFrom);
            if (active) {
                aggregate.activeRateCardCount += 1;
            }
            if (rateCard.effectiveTo) {
                aggregate.contractEndDate = this.maxDate(aggregate.contractEndDate, rateCard.effectiveTo);
                if (rateCard.effectiveTo >= context.now) {
                    aggregate.renewalDate = this.minFutureDate(aggregate.renewalDate, rateCard.effectiveTo, context.now);
                }
            }
        });
        context.incidents.forEach((incident) => {
            const clientId = incident.site?.clientId;
            if (!clientId)
                return;
            const aggregate = aggregates.get(clientId);
            if (!aggregate)
                return;
            aggregate.incidentCount += 1;
            if (HIGH_INCIDENT_SEVERITIES.includes(incident.severity.toLowerCase())) {
                aggregate.highIncidentCount += 1;
            }
        });
        return aggregates;
    }
    buildForecast(context) {
        const now = context.now;
        const generatedAt = now.toISOString();
        const currentMonthStart = this.startOfMonth(now);
        const historyStart = this.addMonths(currentMonthStart, -(HISTORY_MONTHS - 1));
        const actualMonths = Array.from({ length: HISTORY_MONTHS }, (_, index) => {
            const monthStart = this.addMonths(historyStart, index);
            return this.emptyForecastMonth(monthStart, 'actual');
        });
        const actualMonthsByKey = new Map(actualMonths.map((month) => [month.month, month]));
        context.invoices.forEach((invoice) => {
            const invoiceDate = this.invoiceDate(invoice);
            const invoiceMonthKey = this.monthKey(invoiceDate);
            const actualMonth = actualMonthsByKey.get(invoiceMonthKey);
            if (actualMonth) {
                actualMonth.actualRevenue = this.roundCurrency(actualMonth.actualRevenue + invoice.totalAmount);
                if (OUTSTANDING_STATUSES.includes(invoice.status)) {
                    actualMonth.outstandingRevenue = this.roundCurrency(actualMonth.outstandingRevenue + invoice.totalAmount);
                }
            }
            if (invoice.status === 'paid' && invoice.paidAt) {
                const paidMonth = actualMonthsByKey.get(this.monthKey(invoice.paidAt));
                if (paidMonth) {
                    paidMonth.paidRevenue = this.roundCurrency(paidMonth.paidRevenue + invoice.totalAmount);
                }
            }
        });
        const completeActualMonths = actualMonths.filter((month) => month.month < this.monthKey(currentMonthStart));
        const baselineMonths = completeActualMonths.length > 0 ? completeActualMonths : actualMonths;
        const recentMonths = baselineMonths.slice(-3);
        const recentValues = recentMonths.map((month) => month.actualRevenue);
        const baseline = recentValues.length > 0
            ? recentValues.reduce((sum, value) => sum + value, 0) / recentValues.length
            : 0;
        const growthRate = this.calculateAverageGrowthRate(baselineMonths);
        const forecastMonths = Array.from({ length: FORECAST_MONTHS }, (_, index) => {
            const monthStart = this.addMonths(currentMonthStart, index + 1);
            const forecastMonth = this.emptyForecastMonth(monthStart, 'forecast');
            forecastMonth.forecastRevenue = this.roundCurrency(Math.max(0, baseline * (1 + growthRate) ** (index + 1)));
            return forecastMonth;
        });
        const nextMonthRevenue = forecastMonths[0]?.forecastRevenue || 0;
        const quarterlyForecast = this.roundCurrency(forecastMonths
            .slice(0, 3)
            .reduce((sum, month) => sum + month.forecastRevenue, 0));
        const annualForecast = this.roundCurrency(forecastMonths.reduce((sum, month) => sum + month.forecastRevenue, 0));
        const outstandingInvoices = context.invoices.filter((invoice) => OUTSTANDING_STATUSES.includes(invoice.status));
        const outstandingAmount = this.roundCurrency(outstandingInvoices.reduce((sum, invoice) => sum + invoice.totalAmount, 0));
        const expectedCollections = this.roundCurrency(outstandingInvoices.reduce((sum, invoice) => sum + invoice.totalAmount * this.collectionProbability(invoice, now), 0));
        const next30Date = this.addDays(now, 30);
        const expectedCollectionsNext30Days = this.roundCurrency(outstandingInvoices
            .filter((invoice) => {
            const dueOrIssueDate = this.invoiceDueOrIssueDate(invoice);
            return (dueOrIssueDate <= next30Date ||
                (invoice.dueDate !== null && invoice.dueDate <= next30Date));
        })
            .reduce((sum, invoice) => sum + invoice.totalAmount * this.collectionProbability(invoice, now), 0));
        const monthsWithRevenue = actualMonths.filter((month) => month.actualRevenue > 0).length;
        const confidence = this.forecastConfidence(context.invoices.length, monthsWithRevenue);
        const monthlyGrowthRate = this.roundPercent(growthRate * 100);
        const overdue30Count = outstandingInvoices.filter((invoice) => this.daysSince(this.invoiceDueOrIssueDate(invoice), now) > 30).length;
        const insights = [
            {
                id: 'revenue-next-month-forecast',
                category: 'revenue',
                severity: nextMonthRevenue > 0 ? 'positive' : 'info',
                title: 'Next month forecast',
                message: `Estimated revenue next month: ${this.formatCurrency(nextMonthRevenue)}.`,
                metricLabel: 'Forecast',
                metricValue: this.formatCurrency(nextMonthRevenue),
            },
            {
                id: 'revenue-monthly-growth',
                category: 'revenue',
                severity: monthlyGrowthRate > 5
                    ? 'positive'
                    : monthlyGrowthRate < -5
                        ? 'warning'
                        : 'info',
                title: 'Monthly growth trend',
                message: `Revenue is expected to ${monthlyGrowthRate >= 0 ? 'grow' : 'decline'} ${Math.abs(monthlyGrowthRate)}% compared to the recent monthly baseline.`,
                metricLabel: 'Growth',
                metricValue: `${monthlyGrowthRate}%`,
            },
        ];
        if (overdue30Count > 0) {
            insights.push({
                id: 'revenue-overdue-collections',
                category: 'billing',
                severity: overdue30Count >= 5 ? 'warning' : 'info',
                title: 'Overdue collections',
                message: `${overdue30Count} invoices remain unpaid for more than 30 days.`,
                metricLabel: 'Overdue invoices',
                metricValue: overdue30Count,
            });
        }
        if (context.invoices.length === 0) {
            insights.push({
                id: 'revenue-empty-forecast',
                category: 'revenue',
                severity: 'info',
                title: 'Forecast needs invoice history',
                message: 'Generate and issue invoices to unlock stronger revenue forecasting.',
            });
        }
        return {
            generatedAt,
            summary: [
                this.metric('Next month', this.formatCurrency(nextMonthRevenue), 'AI revenue forecast', nextMonthRevenue > 0 ? 'positive' : 'info'),
                this.metric('Quarter forecast', this.formatCurrency(quarterlyForecast), 'Next 3 months', quarterlyForecast > 0 ? 'positive' : 'info'),
                this.metric('Annual forecast', this.formatCurrency(annualForecast), 'Next 12 months', annualForecast > 0 ? 'positive' : 'info'),
                this.metric('Expected collections', this.formatCurrency(expectedCollections), `${this.formatCurrency(expectedCollectionsNext30Days)} next 30 days`, expectedCollections > 0 ? 'warning' : 'info'),
            ],
            insights,
            months: [...actualMonths, ...forecastMonths],
            nextMonthRevenue,
            monthlyGrowthRate,
            quarterlyForecast,
            annualForecast,
            expectedCollections,
            expectedCollectionsNext30Days,
            outstandingAmount,
            confidence,
            methodology: 'Forecasts use the recent three-month invoice revenue baseline, capped month-over-month growth from complete historical months, and probability-weighted collection estimates from outstanding invoice age and dispute status.',
        };
    }
    buildContractIntelligence(context, aggregates) {
        const rows = Array.from(aggregates.values())
            .map((aggregate) => {
            const averagePaymentDays = this.average(aggregate.paymentDays);
            const growthRate = this.clientGrowthRate(aggregate);
            const activeContract = aggregate.activeRateCardCount > 0 ||
                aggregate.siteCount > 0 ||
                this.daysSince(aggregate.lastInvoiceAt || aggregate.createdAt, context.now) <=
                    INACTIVE_CLIENT_DAYS;
            const daysUntilRenewal = aggregate.renewalDate
                ? this.daysBetween(context.now, aggregate.renewalDate)
                : null;
            const totalRevenue = aggregate.totalRevenue;
            const outstandingRatio = totalRevenue > 0 ? aggregate.outstandingAmount / totalRevenue : 0;
            let score = 100;
            if (!activeContract)
                score -= 20;
            if (totalRevenue === 0)
                score -= 15;
            score -= Math.min(25, outstandingRatio * 100);
            if (averagePaymentDays !== null && averagePaymentDays > 30) {
                score -= Math.min(15, (averagePaymentDays - 30) * 0.75);
            }
            score -= Math.min(15, aggregate.disputeCount * 5);
            score -= Math.min(18, aggregate.incidentCount * 3 + aggregate.highIncidentCount * 4);
            if (growthRate < -20)
                score -= 15;
            else if (growthRate < -5)
                score -= 5;
            if (daysUntilRenewal !== null && daysUntilRenewal <= 30)
                score -= 5;
            if (aggregate.lastInvoiceAt &&
                this.daysSince(aggregate.lastInvoiceAt, context.now) >
                    INACTIVE_CLIENT_DAYS) {
                score -= 10;
            }
            const healthScore = this.roundRiskScore(score);
            const healthStatus = this.contractHealthStatus(healthScore);
            const indicators = this.contractIndicators(aggregate, activeContract, healthStatus, averagePaymentDays, daysUntilRenewal, growthRate);
            return {
                clientId: aggregate.clientId,
                name: aggregate.name,
                healthScore,
                healthStatus,
                activeContract,
                contractStartDate: aggregate.firstActivityAt?.toISOString() || null,
                contractEndDate: (aggregate.renewalDate || aggregate.contractEndDate)?.toISOString() ||
                    null,
                daysUntilRenewal,
                invoiceCount: aggregate.invoiceCount,
                totalRevenue,
                outstandingAmount: aggregate.outstandingAmount,
                averagePaymentDays,
                incidentCount: aggregate.incidentCount,
                disputeCount: aggregate.disputeCount,
                lastInvoiceAt: aggregate.lastInvoiceAt?.toISOString() || null,
                indicators,
            };
        })
            .sort((a, b) => a.healthScore - b.healthScore ||
            (a.daysUntilRenewal ?? 9999) - (b.daysUntilRenewal ?? 9999) ||
            b.totalRevenue - a.totalRevenue);
        const activeContracts = rows.filter((row) => row.activeContract).length;
        const highRiskContracts = rows.filter((row) => row.healthStatus === 'High Risk').length;
        const renewalsDue = rows.filter((row) => row.daysUntilRenewal !== null &&
            row.daysUntilRenewal >= 0 &&
            row.daysUntilRenewal <= RENEWAL_WINDOW_DAYS).length;
        const averageHealth = rows.length > 0
            ? this.roundNumber(rows.reduce((sum, row) => sum + row.healthScore, 0) / rows.length, 1)
            : 0;
        const insights = [];
        const strongest = [...rows].sort((a, b) => b.healthScore - a.healthScore)[0];
        const riskiest = rows.find((row) => row.healthStatus === 'High Risk');
        const renewal = rows.find((row) => row.daysUntilRenewal !== null &&
            row.daysUntilRenewal >= 0 &&
            row.daysUntilRenewal <= RENEWAL_WINDOW_DAYS);
        if (strongest) {
            insights.push({
                id: 'contract-health-top',
                category: 'contracts',
                severity: strongest.healthScore >= 85 ? 'positive' : 'info',
                title: 'Strongest contract health',
                message: `${strongest.name} contract health score: ${strongest.healthScore}/100.`,
                subject: strongest.name,
                metricLabel: 'Health score',
                metricValue: strongest.healthScore,
            });
        }
        if (renewal) {
            insights.push({
                id: 'contract-renewal-window',
                category: 'renewals',
                severity: renewal.daysUntilRenewal !== null && renewal.daysUntilRenewal <= 30 ? 'warning' : 'info',
                title: 'Renewal approaching',
                message: `${renewal.name} contract approaching renewal in ${renewal.daysUntilRenewal} days.`,
                subject: renewal.name,
                metricLabel: 'Days remaining',
                metricValue: renewal.daysUntilRenewal ?? 0,
            });
        }
        if (riskiest) {
            insights.push({
                id: 'contract-high-risk',
                category: 'contracts',
                severity: 'critical',
                title: 'High-risk contract',
                message: `${riskiest.name} needs contract review due to health score ${riskiest.healthScore}/100.`,
                subject: riskiest.name,
                metricLabel: 'Health score',
                metricValue: riskiest.healthScore,
            });
        }
        if (insights.length === 0) {
            insights.push({
                id: 'contract-empty',
                category: 'contracts',
                severity: 'info',
                title: 'Contract intelligence needs history',
                message: 'Add rate cards, invoices, and incident history to calculate contract health.',
            });
        }
        return {
            generatedAt: context.now.toISOString(),
            summary: [
                this.metric('Active contracts', activeContracts, `${rows.length} clients analyzed`, activeContracts > 0 ? 'positive' : 'info'),
                this.metric('Average health', `${averageHealth}/100`, 'Contract health score', averageHealth >= 70 ? 'positive' : 'warning'),
                this.metric('Renewals due', renewalsDue, `Next ${RENEWAL_WINDOW_DAYS} days`, renewalsDue > 0 ? 'warning' : 'positive'),
                this.metric('High risk', highRiskContracts, 'Needs review', highRiskContracts > 0 ? 'critical' : 'positive'),
            ],
            insights,
            rows,
        };
    }
    buildClientValueAnalysis(context, aggregates, contracts) {
        const totalRevenue = this.roundCurrency(Array.from(aggregates.values()).reduce((sum, aggregate) => sum + aggregate.totalRevenue, 0));
        const topRevenue = Math.max(...Array.from(aggregates.values()).map((aggregate) => aggregate.totalRevenue), 0);
        const healthByClient = new Map(contracts.map((contract) => [contract.clientId, contract]));
        const rows = Array.from(aggregates.values())
            .map((aggregate) => {
            const growthRate = this.clientGrowthRate(aggregate);
            const revenueShare = totalRevenue > 0
                ? this.roundPercent((aggregate.totalRevenue / totalRevenue) * 100)
                : 0;
            const paidReliability = aggregate.totalRevenue > 0 ? aggregate.paidAmount / aggregate.totalRevenue : 0;
            const revenueComponent = topRevenue > 0 ? (aggregate.totalRevenue / topRevenue) * 45 : 0;
            const paymentComponent = Math.min(20, paidReliability * 20);
            const growthComponent = growthRate > 0 ? Math.min(20, growthRate / 3) : Math.max(-10, growthRate / 4);
            const activityComponent = Math.min(15, aggregate.siteCount * 4 + aggregate.activeRateCardCount * 5);
            const penalty = Math.min(20, aggregate.disputeCount * 4 + aggregate.incidentCount * 2);
            const clientValueScore = this.roundRiskScore(revenueComponent +
                paymentComponent +
                growthComponent +
                activityComponent -
                penalty);
            const health = healthByClient.get(aggregate.clientId);
            const retentionScore = this.roundRiskScore((health?.healthScore ?? 50) -
                Math.min(15, aggregate.activeDisputeCount * 5) -
                (aggregate.outstandingAmount > 0 ? 5 : 0));
            const growthPotentialScore = this.roundRiskScore(50 +
                Math.max(-25, Math.min(30, growthRate)) +
                Math.min(15, aggregate.siteCount * 3) -
                Math.min(20, aggregate.disputeCount * 4 + aggregate.incidentCount * 2) +
                (revenueShare < 15 && aggregate.totalRevenue > 0 ? 10 : 0));
            const indicators = this.clientValueIndicators(aggregate, revenueShare, growthRate, retentionScore, growthPotentialScore);
            return {
                clientId: aggregate.clientId,
                name: aggregate.name,
                totalRevenue: aggregate.totalRevenue,
                revenueShare,
                currentPeriodRevenue: aggregate.currentPeriodRevenue,
                previousPeriodRevenue: aggregate.previousPeriodRevenue,
                growthRate,
                invoiceCount: aggregate.invoiceCount,
                disputeCount: aggregate.disputeCount,
                incidentCount: aggregate.incidentCount,
                clientValueScore,
                retentionScore,
                growthPotentialScore,
                indicators,
            };
        })
            .sort((a, b) => b.clientValueScore - a.clientValueScore ||
            b.totalRevenue - a.totalRevenue ||
            a.name.localeCompare(b.name));
        const topClient = rows.find((row) => row.totalRevenue > 0);
        const fastestGrowing = [...rows]
            .filter((row) => row.currentPeriodRevenue > 0 && row.growthRate > 0)
            .sort((a, b) => b.growthRate - a.growthRate)[0];
        const lowValue = [...rows]
            .filter((row) => row.invoiceCount > 0)
            .sort((a, b) => a.clientValueScore - b.clientValueScore)[0];
        const frequentDisputes = rows.find((row) => row.disputeCount >= 2);
        const insights = [];
        if (topClient) {
            insights.push({
                id: 'client-value-top-revenue',
                category: 'clients',
                severity: topClient.revenueShare >= 35 ? 'warning' : 'positive',
                title: 'Highest revenue client',
                message: `${topClient.name} contributes ${topClient.revenueShare}% of total revenue.`,
                subject: topClient.name,
                metricLabel: 'Revenue share',
                metricValue: `${topClient.revenueShare}%`,
            });
        }
        if (fastestGrowing) {
            insights.push({
                id: 'client-value-fastest-growth',
                category: 'clients',
                severity: 'positive',
                title: 'Fastest growing client',
                message: `${fastestGrowing.name} revenue is up ${fastestGrowing.growthRate}% versus the previous period.`,
                subject: fastestGrowing.name,
                metricLabel: 'Growth',
                metricValue: `${fastestGrowing.growthRate}%`,
            });
        }
        if (lowValue && lowValue.clientValueScore < 45) {
            insights.push({
                id: 'client-value-low-score',
                category: 'clients',
                severity: 'warning',
                title: 'Low-value contract',
                message: `${lowValue.name} has a client value score of ${lowValue.clientValueScore}/100.`,
                subject: lowValue.name,
                metricLabel: 'Value score',
                metricValue: lowValue.clientValueScore,
            });
        }
        if (frequentDisputes) {
            insights.push({
                id: 'client-value-disputes',
                category: 'billing',
                severity: 'warning',
                title: 'Frequent disputes',
                message: `${frequentDisputes.name} has ${frequentDisputes.disputeCount} invoice disputes.`,
                subject: frequentDisputes.name,
                metricLabel: 'Disputes',
                metricValue: frequentDisputes.disputeCount,
            });
        }
        if (insights.length === 0) {
            insights.push({
                id: 'client-value-empty',
                category: 'clients',
                severity: 'info',
                title: 'Client value needs billing data',
                message: 'Issue invoices and track payments to calculate client value scores.',
            });
        }
        return {
            generatedAt: context.now.toISOString(),
            summary: [
                this.metric('Top revenue share', topClient ? `${topClient.revenueShare}%` : '0%', topClient?.name || 'No revenue yet', topClient ? 'positive' : 'info'),
                this.metric('Fastest growth', fastestGrowing ? `${fastestGrowing.growthRate}%` : '0%', fastestGrowing?.name || 'No growth trend', fastestGrowing ? 'positive' : 'info'),
                this.metric('Avg value score', rows.length ? `${this.roundNumber(rows.reduce((sum, row) => sum + row.clientValueScore, 0) / rows.length, 1)}/100` : '0/100', 'All clients', rows.length ? 'info' : 'warning'),
                this.metric('Dispute clients', rows.filter((row) => row.disputeCount > 0).length, 'With invoice disputes', rows.some((row) => row.disputeCount > 0) ? 'warning' : 'positive'),
            ],
            insights,
            rows,
        };
    }
    buildRenewalOpportunities(context, contracts, clientValues) {
        const valueByClient = new Map(clientValues.map((client) => [client.clientId, client]));
        const rows = [];
        contracts.forEach((contract) => {
            const value = valueByClient.get(contract.clientId);
            const revenueAtRisk = value?.currentPeriodRevenue ||
                this.roundCurrency((contract.totalRevenue || 0) / 4);
            if (contract.daysUntilRenewal !== null &&
                contract.daysUntilRenewal >= 0 &&
                contract.daysUntilRenewal <= RENEWAL_WINDOW_DAYS) {
                rows.push({
                    id: `renewal-${contract.clientId}`,
                    clientId: contract.clientId,
                    name: contract.name,
                    type: 'renewal_due',
                    priority: contract.daysUntilRenewal <= 30
                        ? 'high'
                        : contract.daysUntilRenewal <= 60
                            ? 'medium'
                            : 'low',
                    dueDate: contract.contractEndDate,
                    daysUntilRenewal: contract.daysUntilRenewal,
                    estimatedRevenueAtRisk: revenueAtRisk,
                    recommendation: `Contact ${contract.name} for renewal discussion.`,
                    reason: `Contract renewal is due in ${contract.daysUntilRenewal} days.`,
                });
            }
            if (contract.lastInvoiceAt &&
                this.daysSince(new Date(contract.lastInvoiceAt), context.now) >
                    INACTIVE_CLIENT_DAYS) {
                rows.push({
                    id: `inactive-${contract.clientId}`,
                    clientId: contract.clientId,
                    name: contract.name,
                    type: 'inactive_client',
                    priority: 'medium',
                    dueDate: null,
                    daysUntilRenewal: null,
                    estimatedRevenueAtRisk: revenueAtRisk,
                    recommendation: `Re-engage ${contract.name} before revenue becomes inactive.`,
                    reason: `No invoice activity in more than ${INACTIVE_CLIENT_DAYS} days.`,
                });
            }
            if (value &&
                value.previousPeriodRevenue > 0 &&
                value.growthRate <= -20) {
                rows.push({
                    id: `declining-${contract.clientId}`,
                    clientId: contract.clientId,
                    name: contract.name,
                    type: 'declining_revenue',
                    priority: value.growthRate <= -40 ? 'high' : 'medium',
                    dueDate: contract.contractEndDate,
                    daysUntilRenewal: contract.daysUntilRenewal,
                    estimatedRevenueAtRisk: revenueAtRisk,
                    recommendation: `Review service scope and retention plan for ${contract.name}.`,
                    reason: `Revenue declined ${Math.abs(value.growthRate)}% versus the previous period.`,
                });
            }
            if (value &&
                value.invoiceCount > 0 &&
                value.clientValueScore < 45 &&
                contract.activeContract) {
                rows.push({
                    id: `pricing-${contract.clientId}`,
                    clientId: contract.clientId,
                    name: contract.name,
                    type: 'pricing_review',
                    priority: contract.healthStatus === 'High Risk' ? 'high' : 'medium',
                    dueDate: contract.contractEndDate,
                    daysUntilRenewal: contract.daysUntilRenewal,
                    estimatedRevenueAtRisk: revenueAtRisk,
                    recommendation: `Review pricing strategy for ${contract.name}.`,
                    reason: `Client value score is ${value.clientValueScore}/100 on an active contract.`,
                });
            }
        });
        const sortedRows = rows.sort((a, b) => this.priorityRank(a.priority) - this.priorityRank(b.priority) ||
            (a.daysUntilRenewal ?? 9999) - (b.daysUntilRenewal ?? 9999) ||
            b.estimatedRevenueAtRisk - a.estimatedRevenueAtRisk);
        const dueSoon = sortedRows.filter((row) => row.type === 'renewal_due').length;
        const inactive = sortedRows.filter((row) => row.type === 'inactive_client').length;
        const declining = sortedRows.filter((row) => row.type === 'declining_revenue').length;
        const revenueAtRisk = this.roundCurrency(sortedRows.reduce((sum, row) => sum + row.estimatedRevenueAtRisk, 0));
        const first = sortedRows[0];
        const insights = first
            ? [
                {
                    id: 'renewal-top-opportunity',
                    category: 'renewals',
                    severity: first.priority === 'high' ? 'warning' : 'info',
                    title: 'Top renewal opportunity',
                    message: first.recommendation,
                    subject: first.name,
                    metricLabel: 'Revenue at risk',
                    metricValue: this.formatCurrency(first.estimatedRevenueAtRisk),
                },
            ]
            : [
                {
                    id: 'renewal-empty',
                    category: 'renewals',
                    severity: 'positive',
                    title: 'No urgent renewal risk',
                    message: `No contracts are currently flagged inside the ${RENEWAL_WINDOW_DAYS}-day renewal window.`,
                },
            ];
        return {
            generatedAt: context.now.toISOString(),
            summary: [
                this.metric('Renewals due', dueSoon, `Next ${RENEWAL_WINDOW_DAYS} days`, dueSoon > 0 ? 'warning' : 'positive'),
                this.metric('Inactive clients', inactive, `No invoices in ${INACTIVE_CLIENT_DAYS}+ days`, inactive > 0 ? 'warning' : 'positive'),
                this.metric('Declining revenue', declining, 'Period-over-period decline', declining > 0 ? 'warning' : 'positive'),
                this.metric('Revenue at risk', this.formatCurrency(revenueAtRisk), 'Opportunity pipeline', revenueAtRisk > 0 ? 'warning' : 'positive'),
            ],
            insights,
            rows: sortedRows,
        };
    }
    async buildFinancialRecommendations(context, forecast, clientValue, contracts, renewals) {
        const ruleRecommendations = this.buildRuleFinancialRecommendations(context, forecast, clientValue, contracts, renewals);
        const aiRecommendations = await this.buildAiFinancialRecommendations(forecast, clientValue, contracts, renewals, ruleRecommendations);
        const recommendations = [...aiRecommendations, ...ruleRecommendations].slice(0, 10);
        const highPriority = recommendations.filter((recommendation) => recommendation.priority === 'high').length;
        return {
            generatedAt: context.now.toISOString(),
            source: aiRecommendations.length > 0 ? 'ai_assisted' : 'rule_based',
            summary: [
                this.metric('Recommendations', recommendations.length, 'Ready for review', recommendations.length > 0 ? 'info' : 'positive'),
                this.metric('High priority', highPriority, 'Needs action first', highPriority > 0 ? 'critical' : 'positive'),
                this.metric('AI generated', aiRecommendations.length, 'Finance intelligence', aiRecommendations.length > 0 ? 'positive' : 'info'),
                this.metric('Rule fallback', ruleRecommendations.length, 'Deterministic analytics', 'info'),
            ],
            recommendations,
            aiRecommendations,
            ruleRecommendations,
        };
    }
    buildRuleFinancialRecommendations(context, forecast, clientValue, contracts, renewals) {
        const recommendations = [];
        const overdueInvoices = context.invoices.filter((invoice) => OUTSTANDING_STATUSES.includes(invoice.status) &&
            this.daysSince(this.invoiceDueOrIssueDate(invoice), context.now) > 30);
        const topOutstanding = contracts.rows
            .filter((contract) => contract.outstandingAmount > 0)
            .sort((a, b) => b.outstandingAmount - a.outstandingAmount)[0];
        const highRiskContract = contracts.rows.find((contract) => contract.healthStatus === 'High Risk');
        const topRenewal = renewals.rows[0];
        const topGrowthClient = [...clientValue.rows]
            .filter((client) => client.growthPotentialScore >= 70)
            .sort((a, b) => b.growthPotentialScore - a.growthPotentialScore)[0];
        const topValueClient = clientValue.rows[0];
        const topSite = this.topRevenueSite(context);
        if (overdueInvoices.length > 0) {
            recommendations.push({
                id: 'revenue-rule-overdue-invoices',
                category: 'billing',
                priority: overdueInvoices.length >= 5 ? 'high' : 'medium',
                title: 'Follow up overdue invoices',
                action: `Follow up on ${overdueInvoices.length} invoices unpaid for more than 30 days.`,
                reason: `${this.formatCurrency(overdueInvoices.reduce((sum, invoice) => sum + invoice.totalAmount, 0))} is overdue and affecting expected collections.`,
                source: 'rule',
                actionType: 'create_invoice_followup',
                targetModule: 'invoice',
                targetEntityId: overdueInvoices[0]?.id ?? null,
            });
        }
        if (topOutstanding) {
            recommendations.push({
                id: 'revenue-rule-outstanding-client',
                category: 'billing',
                priority: topOutstanding.outstandingAmount >= 5000 ? 'high' : 'medium',
                title: 'Improve collection process',
                action: `Create a collections plan for ${topOutstanding.name}.`,
                reason: `${topOutstanding.name} has ${this.formatCurrency(topOutstanding.outstandingAmount)} outstanding.`,
                source: 'rule',
                actionType: 'create_invoice_followup',
                targetModule: 'client',
                targetEntityId: topOutstanding.clientId,
            });
        }
        if (highRiskContract) {
            recommendations.push({
                id: 'revenue-rule-contract-risk',
                category: 'contracts',
                priority: 'high',
                title: 'Review contract risk',
                action: `Review contract terms and payment behavior for ${highRiskContract.name}.`,
                reason: `${highRiskContract.name} has a contract health score of ${highRiskContract.healthScore}/100.`,
                source: 'rule',
                actionType: 'flag_client_risk',
                targetModule: 'client',
                targetEntityId: highRiskContract.clientId,
            });
        }
        if (topRenewal) {
            recommendations.push({
                id: 'revenue-rule-renewal',
                category: 'renewals',
                priority: topRenewal.priority,
                title: 'Start renewal outreach',
                action: topRenewal.recommendation,
                reason: topRenewal.reason,
                source: 'rule',
                actionType: 'create_follow_up_task',
                targetModule: 'client',
                targetEntityId: topRenewal.clientId,
            });
        }
        if (topValueClient && topValueClient.totalRevenue > 0) {
            recommendations.push({
                id: 'revenue-rule-high-value-client',
                category: 'clients',
                priority: topValueClient.revenueShare >= 30 ? 'high' : 'medium',
                title: 'Focus on high-value client',
                action: `Protect and expand the relationship with ${topValueClient.name}.`,
                reason: `${topValueClient.name} contributes ${topValueClient.revenueShare}% of total revenue.`,
                source: 'rule',
                actionType: 'flag_client_risk',
                targetModule: 'client',
                targetEntityId: topValueClient.clientId,
            });
        }
        if (topGrowthClient) {
            recommendations.push({
                id: 'revenue-rule-growth-potential',
                category: 'clients',
                priority: 'medium',
                title: 'Capture growth potential',
                action: `Discuss expanded coverage with ${topGrowthClient.name}.`,
                reason: `${topGrowthClient.name} has a growth potential score of ${topGrowthClient.growthPotentialScore}/100.`,
                source: 'rule',
                actionType: 'create_follow_up_task',
                targetModule: 'client',
                targetEntityId: topGrowthClient.clientId,
            });
        }
        if (topSite) {
            recommendations.push({
                id: 'revenue-rule-profitable-site',
                category: 'sites',
                priority: 'medium',
                title: 'Staff profitable site capacity',
                action: `Review staffing capacity for ${topSite.name}.`,
                reason: `${topSite.name} generated ${this.formatCurrency(topSite.revenue)} in invoice revenue.`,
                source: 'rule',
                actionType: 'flag_site_risk',
                targetModule: 'site',
                targetEntityId: topSite.id,
            });
        }
        if (forecast.monthlyGrowthRate > 10 && topSite) {
            recommendations.push({
                id: 'revenue-rule-growth-staffing',
                category: 'operations',
                priority: 'medium',
                title: 'Prepare for forecast growth',
                action: `Increase staffing readiness for profitable sites before next month's forecasted demand.`,
                reason: `Revenue is forecast to grow ${forecast.monthlyGrowthRate}% from the recent baseline.`,
                source: 'rule',
                actionType: 'create_follow_up_task',
                targetModule: 'operations',
            });
        }
        if (recommendations.length === 0) {
            recommendations.push({
                id: 'revenue-rule-maintain-cadence',
                category: 'revenue',
                priority: 'low',
                title: 'Maintain finance review cadence',
                action: 'Review revenue, renewals, and collections every week.',
                reason: 'No high-priority revenue or contract risk was detected in the available data.',
                source: 'rule',
                actionType: 'create_follow_up_task',
                targetModule: 'revenue',
            });
        }
        return recommendations;
    }
    async buildAiFinancialRecommendations(forecast, clientValue, contracts, renewals, ruleRecommendations) {
        try {
            const generated = await this.aiService.generateRevenueFinancialRecommendations(JSON.stringify({
                forecast: {
                    nextMonthRevenue: forecast.nextMonthRevenue,
                    monthlyGrowthRate: forecast.monthlyGrowthRate,
                    quarterlyForecast: forecast.quarterlyForecast,
                    annualForecast: forecast.annualForecast,
                    expectedCollections: forecast.expectedCollections,
                    outstandingAmount: forecast.outstandingAmount,
                    confidence: forecast.confidence,
                },
                topClients: clientValue.rows.slice(0, 5),
                contractRisks: contracts.rows.slice(0, 5),
                renewalOpportunities: renewals.rows.slice(0, 5),
                currentRuleActions: ruleRecommendations.map((recommendation) => recommendation.action),
            }));
            if (!generated?.length) {
                return [];
            }
            return generated.map((item, index) => this.mapAiRecommendation(item, index));
        }
        catch (error) {
            this.logger.warn(`Revenue AI recommendations skipped: ${error instanceof Error ? error.message : String(error)}`);
            return [];
        }
    }
    async buildAiSummary(context, forecast, clientValue, contracts, renewals, recommendations) {
        try {
            return await this.aiService.generateRevenueIntelligenceSummary(JSON.stringify({
                generatedAt: context.now.toISOString(),
                forecast: {
                    nextMonthRevenue: forecast.nextMonthRevenue,
                    monthlyGrowthRate: forecast.monthlyGrowthRate,
                    quarterlyForecast: forecast.quarterlyForecast,
                    annualForecast: forecast.annualForecast,
                    expectedCollections: forecast.expectedCollections,
                    confidence: forecast.confidence,
                },
                topClients: clientValue.rows.slice(0, 3),
                contractRisks: contracts.rows.slice(0, 3),
                renewals: renewals.rows.slice(0, 3),
                recommendations: recommendations.recommendations
                    .slice(0, 4)
                    .map((recommendation) => recommendation.action),
            }));
        }
        catch (error) {
            this.logger.warn(`Revenue AI summary skipped: ${error instanceof Error ? error.message : String(error)}`);
            return null;
        }
    }
    fallbackRevenueSummary(forecast, clientValue, contracts, renewals, recommendations) {
        const topClient = clientValue.rows.find((client) => client.totalRevenue > 0);
        const contractRisk = contracts.rows.find((contract) => contract.healthStatus === 'High Risk');
        const renewal = renewals.rows[0];
        const action = recommendations.recommendations[0]?.action;
        return [
            `Estimated revenue next month is ${this.formatCurrency(forecast.nextMonthRevenue)}, with ${forecast.monthlyGrowthRate}% expected monthly growth from recent invoice trends.`,
            `Expected collections are ${this.formatCurrency(forecast.expectedCollections)}.`,
            topClient
                ? `${topClient.name} contributes ${topClient.revenueShare}% of total revenue.`
                : null,
            contractRisk
                ? `${contractRisk.name} is the highest contract risk at ${contractRisk.healthScore}/100.`
                : renewal
                    ? renewal.recommendation
                    : null,
            action || null,
        ]
            .filter(Boolean)
            .join(' ');
    }
    mapAiRecommendation(item, index) {
        return {
            id: `revenue-ai-recommendation-${index + 1}`,
            category: 'revenue',
            priority: item.priority,
            title: item.title,
            action: item.action,
            reason: item.reason,
            source: 'ai',
            actionType: 'notify_admin',
            targetModule: 'revenue',
        };
    }
    getOrCreateAggregate(aggregates, invoice) {
        return this.getOrCreateAggregateForClient(aggregates, invoice.clientId, invoice.client ? this.clientDisplayName(invoice.client) : 'Unknown client', invoice.createdAt);
    }
    getOrCreateAggregateForClient(aggregates, clientId, name, createdAt) {
        const existing = aggregates.get(clientId);
        if (existing)
            return existing;
        const aggregate = {
            clientId,
            name,
            createdAt,
            siteCount: 0,
            contractActivity: 0,
            invoiceCount: 0,
            totalRevenue: 0,
            paidAmount: 0,
            outstandingAmount: 0,
            currentPeriodRevenue: 0,
            previousPeriodRevenue: 0,
            disputeCount: 0,
            activeDisputeCount: 0,
            incidentCount: 0,
            highIncidentCount: 0,
            paymentDays: [],
            lastInvoiceAt: null,
            firstActivityAt: createdAt,
            activeRateCardCount: 0,
            rateCardCount: 0,
            contractEndDate: null,
            renewalDate: null,
        };
        aggregates.set(clientId, aggregate);
        return aggregate;
    }
    calculateAverageGrowthRate(months) {
        const samples = months.slice(-7);
        const growthRates = [];
        for (let index = 1; index < samples.length; index += 1) {
            const previous = samples[index - 1].actualRevenue;
            const current = samples[index].actualRevenue;
            if (previous > 0) {
                growthRates.push(this.clamp((current - previous) / previous, -0.5, 0.5));
            }
        }
        if (growthRates.length === 0)
            return 0;
        return growthRates.reduce((sum, value) => sum + value, 0) / growthRates.length;
    }
    forecastConfidence(invoiceCount, monthsWithRevenue) {
        if (invoiceCount >= 20 && monthsWithRevenue >= 6)
            return 'high';
        if (invoiceCount >= 6 && monthsWithRevenue >= 3)
            return 'medium';
        return 'low';
    }
    collectionProbability(invoice, now) {
        const dueDate = invoice.dueDate;
        const referenceDate = this.invoiceDueOrIssueDate(invoice);
        const daysPastDue = dueDate && dueDate < now ? this.daysBetween(dueDate, now) : 0;
        let probability = 0.9;
        if (daysPastDue > 90)
            probability = 0.2;
        else if (daysPastDue > 60)
            probability = 0.35;
        else if (daysPastDue > 30)
            probability = 0.55;
        else if (daysPastDue > 0)
            probability = 0.75;
        else if (this.daysSince(referenceDate, now) > 45)
            probability = 0.7;
        if (this.isDisputedInvoice(invoice)) {
            probability *= 0.55;
        }
        return this.clamp(probability, 0, 1);
    }
    contractIndicators(aggregate, activeContract, healthStatus, averagePaymentDays, daysUntilRenewal, growthRate) {
        const indicators = [];
        indicators.push(activeContract ? 'Active contract activity' : 'No active contract activity');
        indicators.push(`${healthStatus} health`);
        if (daysUntilRenewal !== null) {
            indicators.push(`Renewal in ${daysUntilRenewal} days`);
        }
        if (aggregate.outstandingAmount > 0) {
            indicators.push(`${this.formatCurrency(aggregate.outstandingAmount)} outstanding`);
        }
        if (averagePaymentDays !== null) {
            indicators.push(`${averagePaymentDays} avg days to pay`);
        }
        if (aggregate.incidentCount > 0) {
            indicators.push(`${aggregate.incidentCount} incidents in ${INCIDENT_LOOKBACK_DAYS} days`);
        }
        if (aggregate.disputeCount > 0) {
            indicators.push(`${aggregate.disputeCount} invoice disputes`);
        }
        if (growthRate < 0) {
            indicators.push(`${Math.abs(growthRate)}% revenue decline`);
        }
        return indicators.slice(0, 6);
    }
    clientValueIndicators(aggregate, revenueShare, growthRate, retentionScore, growthPotentialScore) {
        const indicators = [
            `${revenueShare}% revenue share`,
            `${growthRate}% growth`,
            `${retentionScore}/100 retention`,
            `${growthPotentialScore}/100 growth potential`,
        ];
        if (aggregate.disputeCount > 0) {
            indicators.push(`${aggregate.disputeCount} disputes`);
        }
        if (aggregate.incidentCount > 0) {
            indicators.push(`${aggregate.incidentCount} incidents`);
        }
        if (aggregate.outstandingAmount > 0) {
            indicators.push(`${this.formatCurrency(aggregate.outstandingAmount)} outstanding`);
        }
        return indicators;
    }
    topRevenueSite(context) {
        const sites = new Map();
        context.invoices.forEach((invoice) => {
            if (!invoice.site)
                return;
            const site = sites.get(invoice.siteId) || {
                id: invoice.siteId,
                name: invoice.site.name,
                revenue: 0,
            };
            site.revenue = this.roundCurrency(site.revenue + invoice.totalAmount);
            sites.set(invoice.siteId, site);
        });
        return Array.from(sites.values()).sort((a, b) => b.revenue - a.revenue)[0];
    }
    emptyForecastMonth(monthStart, type) {
        return {
            month: this.monthKey(monthStart),
            label: monthStart.toLocaleString('en-US', {
                month: 'short',
                year: 'numeric',
                timeZone: 'UTC',
            }),
            type,
            actualRevenue: 0,
            paidRevenue: 0,
            outstandingRevenue: 0,
            forecastRevenue: 0,
        };
    }
    clientGrowthRate(aggregate) {
        if (aggregate.previousPeriodRevenue <= 0) {
            return aggregate.currentPeriodRevenue > 0 ? 100 : 0;
        }
        return this.roundPercent(((aggregate.currentPeriodRevenue - aggregate.previousPeriodRevenue) /
            aggregate.previousPeriodRevenue) *
            100);
    }
    contractHealthStatus(score) {
        if (score >= 85)
            return 'Excellent';
        if (score >= 70)
            return 'Good';
        if (score >= 50)
            return 'Warning';
        return 'High Risk';
    }
    isActiveRateCard(rateCard, now) {
        return (rateCard.status === 'active' &&
            rateCard.effectiveFrom <= now &&
            (!rateCard.effectiveTo || rateCard.effectiveTo >= now));
    }
    isDisputedInvoice(invoice) {
        return (invoice.status === 'disputed' ||
            invoice.disputes.some((dispute) => ACTIVE_DISPUTE_STATUSES.includes(dispute.status)));
    }
    invoiceDate(invoice) {
        return invoice.issuedAt ?? invoice.createdAt;
    }
    invoiceDueOrIssueDate(invoice) {
        return invoice.dueDate ?? invoice.issuedAt ?? invoice.createdAt;
    }
    startOfMonth(date) {
        return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
    }
    addMonths(date, months) {
        return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
    }
    addDays(date, days) {
        const next = new Date(date);
        next.setUTCDate(next.getUTCDate() + days);
        return next;
    }
    monthKey(date) {
        return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
    }
    daysBetween(start, end) {
        return Math.max(0, Math.ceil((end.getTime() - start.getTime()) / MS_PER_DAY));
    }
    daysSince(date, now) {
        return this.daysBetween(date, now);
    }
    minDate(current, value) {
        if (!current)
            return value;
        return value < current ? value : current;
    }
    maxDate(current, value) {
        if (!current)
            return value;
        return value > current ? value : current;
    }
    minFutureDate(current, value, now) {
        if (value < now)
            return current;
        if (!current)
            return value;
        return value < current ? value : current;
    }
    average(values) {
        if (values.length === 0)
            return null;
        return this.roundNumber(values.reduce((sum, value) => sum + value, 0) / values.length, 1);
    }
    roundCurrency(value) {
        return Math.round(value * 100) / 100;
    }
    roundPercent(value) {
        return Math.round(value * 10) / 10;
    }
    roundNumber(value, decimals) {
        const factor = 10 ** decimals;
        return Math.round(value * factor) / factor;
    }
    roundRiskScore(score) {
        return Math.max(0, Math.min(100, Math.round(score)));
    }
    clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }
    priorityRank(priority) {
        if (priority === 'high')
            return 0;
        if (priority === 'medium')
            return 1;
        return 2;
    }
    metric(label, value, detail, tone) {
        return { label, value, detail, tone };
    }
    clientDisplayName(client) {
        return client.companyName || client.name;
    }
    formatCurrency(value) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            maximumFractionDigits: value >= 1000 ? 0 : 2,
        }).format(value);
    }
    async logAudit(tenantId, userId, action, entityType, details) {
        try {
            await this.auditService.log({
                tenantId,
                userId,
                action,
                entityType,
                details,
            });
        }
        catch (error) {
            this.logger.warn(`Revenue audit log skipped: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
};
exports.RevenueInsightsService = RevenueInsightsService;
exports.RevenueInsightsService = RevenueInsightsService = RevenueInsightsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        ai_service_1.AiService,
        audit_service_1.AuditService])
], RevenueInsightsService);
//# sourceMappingURL=revenue-insights.service.js.map