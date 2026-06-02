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
var AiInsightsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiInsightsService = void 0;
const common_1 = require("@nestjs/common");
const ai_governance_service_1 = require("../ai-governance/ai-governance.service");
const ai_service_1 = require("../ai/ai.service");
const ai_monitoring_service_1 = require("../ai-monitoring/ai-monitoring.service");
const prisma_service_1 = require("../prisma/prisma.service");
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const LATE_CHECK_IN_MINUTES = 5;
const INCIDENT_ANALYSIS_DAYS = 90;
const RECENT_INCIDENT_DAYS = 7;
const REVENUE_STATUSES = ['issued', 'disputed', 'resolved', 'paid'];
const OUTSTANDING_STATUSES = ['issued', 'resolved', 'disputed'];
const ACTIVE_DISPUTE_STATUSES = ['open', 'under_review'];
const DEFAULT_PROMPT_VERSION = 'v5-phase-7';
const INCIDENT_SEVERITY_SCORES = {
    critical: 30,
    high: 20,
    medium: 10,
    low: 5,
};
const INCIDENT_SEVERITY_ORDER = ['critical', 'high', 'medium', 'low'];
let AiInsightsService = AiInsightsService_1 = class AiInsightsService {
    prisma;
    aiService;
    aiMonitoringService;
    aiGovernanceService;
    logger = new common_1.Logger(AiInsightsService_1.name);
    constructor(prisma, aiService, aiMonitoringService, aiGovernanceService) {
        this.prisma = prisma;
        this.aiService = aiService;
        this.aiMonitoringService = aiMonitoringService;
        this.aiGovernanceService = aiGovernanceService;
    }
    async getDashboard(tenantId, userId) {
        const [clients, guards, sites, billing] = await Promise.all([
            this.getClientInsights(tenantId),
            this.getGuardInsights(tenantId),
            this.getSiteInsights(tenantId),
            this.getBillingInsights(tenantId),
        ]);
        const ruleRecommendations = this.buildRuleRecommendations(clients, guards, sites, billing);
        const aiRecommendations = await this.buildAiRecommendations(tenantId, clients, guards, sites, billing, ruleRecommendations);
        const recommendations = await this.aiMonitoringService.applyFeedbackToRecommendations(tenantId, [
            ...aiRecommendations,
            ...ruleRecommendations,
        ].slice(0, 10));
        const dashboard = {
            generatedAt: new Date().toISOString(),
            source: aiRecommendations.length > 0 ? 'ai_assisted' : 'rule_based',
            overview: this.buildOverview(clients, guards, sites, billing, recommendations),
            clients,
            guards,
            sites,
            billing,
            recommendations,
        };
        const generation = await this.aiMonitoringService.logGeneration({
            tenantId,
            createdBy: userId,
            promptVersion: DEFAULT_PROMPT_VERSION,
            promptKey: 'business_recommendations',
            modelUsed: this.aiService.getModelName(),
            sourceModule: 'ai_insights.dashboard',
            generatedOutput: dashboard,
            fallbackUsed: aiRecommendations.length === 0,
            status: aiRecommendations.length > 0 ? 'success' : 'fallback',
        });
        return {
            ...dashboard,
            aiGenerationId: generation?.id,
            recommendations: this.aiMonitoringService.attachGenerationId(dashboard.recommendations, generation?.id),
        };
    }
    async getClientInsights(tenantId) {
        const now = new Date();
        const monthStart = this.startOfMonth(now);
        const [clients, invoices, incidents] = await Promise.all([
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
                            proposals: true,
                            deals: true,
                            rateCards: true,
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.invoice.findMany({
                where: {
                    tenantId,
                    status: { in: REVENUE_STATUSES },
                },
                select: {
                    clientId: true,
                    totalAmount: true,
                    status: true,
                    issuedAt: true,
                    createdAt: true,
                },
            }),
            this.prisma.incident.findMany({
                where: {
                    tenantId,
                    occurredAt: { gte: monthStart },
                },
                select: {
                    id: true,
                    severity: true,
                    site: {
                        select: {
                            clientId: true,
                        },
                    },
                },
            }),
        ]);
        const revenueByClient = new Map();
        invoices
            .filter((invoice) => this.isCurrentPeriod(this.invoiceDate(invoice), now))
            .forEach((invoice) => {
            revenueByClient.set(invoice.clientId, this.roundCurrency((revenueByClient.get(invoice.clientId) || 0) +
                invoice.totalAmount));
        });
        const incidentByClient = new Map();
        incidents.forEach((incident) => {
            const clientId = incident.site?.clientId;
            if (!clientId)
                return;
            incidentByClient.set(clientId, (incidentByClient.get(clientId) || 0) + 1);
        });
        const totalRevenue = this.roundCurrency(Array.from(revenueByClient.values()).reduce((sum, value) => sum + value, 0));
        const rows = clients
            .map((client) => {
            const revenue = revenueByClient.get(client.id) || 0;
            const contractActivity = client._count.proposals + client._count.deals + client._count.rateCards;
            return {
                clientId: client.id,
                name: this.clientDisplayName(client),
                active: client._count.sites > 0 ||
                    client._count.invoices > 0 ||
                    contractActivity > 0,
                revenue,
                revenueShare: totalRevenue > 0 ? this.roundPercent((revenue / totalRevenue) * 100) : 0,
                incidentCount: incidentByClient.get(client.id) || 0,
                contractActivity,
                siteCount: client._count.sites,
            };
        })
            .sort((a, b) => b.revenue - a.revenue ||
            b.incidentCount - a.incidentCount ||
            a.name.localeCompare(b.name));
        const activeClientCount = rows.filter((client) => client.active).length;
        const totalIncidents = rows.reduce((sum, client) => sum + client.incidentCount, 0);
        const averageIncidents = activeClientCount > 0 ? totalIncidents / activeClientCount : 0;
        const topRevenueClient = rows.find((client) => client.revenue > 0);
        const highIncidentClient = rows.find((client) => client.incidentCount > 0 && client.incidentCount > averageIncidents);
        const activeContracts = rows.reduce((sum, client) => sum + client.contractActivity, 0);
        const insights = [];
        if (topRevenueClient) {
            insights.push({
                id: 'clients-top-revenue',
                category: 'clients',
                severity: topRevenueClient.revenueShare >= 35 ? 'warning' : 'info',
                title: 'Revenue concentration',
                message: `${topRevenueClient.name} generated ${topRevenueClient.revenueShare}% of monthly revenue.`,
                subject: topRevenueClient.name,
                metricLabel: 'Monthly revenue',
                metricValue: this.formatCurrency(topRevenueClient.revenue),
            });
        }
        if (highIncidentClient) {
            insights.push({
                id: 'clients-high-incidents',
                category: 'clients',
                severity: highIncidentClient.incidentCount >= 3 ? 'warning' : 'info',
                title: 'Higher incident frequency',
                message: `${highIncidentClient.name} has higher than average incident reports this month.`,
                subject: highIncidentClient.name,
                metricLabel: 'Incidents',
                metricValue: highIncidentClient.incidentCount,
            });
        }
        if (activeClientCount > 0) {
            insights.push({
                id: 'clients-active-base',
                category: 'clients',
                severity: 'positive',
                title: 'Active client base',
                message: `${activeClientCount} clients have active sites, invoices, contracts, or proposals.`,
                metricLabel: 'Active clients',
                metricValue: activeClientCount,
            });
        }
        if (insights.length === 0) {
            insights.push(this.emptyInsight('clients', 'Client insights need data'));
        }
        return {
            generatedAt: now.toISOString(),
            summary: [
                this.metric('Active clients', activeClientCount, `${clients.length} total`, 'info'),
                this.metric('Monthly revenue', this.formatCurrency(totalRevenue), this.monthLabel(now), totalRevenue > 0 ? 'positive' : 'info'),
                this.metric('Client incidents', totalIncidents, 'Current month', totalIncidents > 0 ? 'warning' : 'positive'),
                this.metric('Contract activity', activeContracts, 'Deals, proposals, rate cards', activeContracts > 0 ? 'positive' : 'info'),
            ],
            insights,
            rows,
        };
    }
    async getGuardInsights(tenantId) {
        const now = new Date();
        const monthStart = this.startOfMonth(now);
        const [guards, shifts] = await Promise.all([
            this.prisma.guard.findMany({
                where: { tenantId },
                select: {
                    id: true,
                    name: true,
                    createdAt: true,
                },
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.shift.findMany({
                where: {
                    tenantId,
                    startTime: { gte: monthStart },
                },
                select: {
                    id: true,
                    startTime: true,
                    endTime: true,
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
                    incidents: {
                        select: {
                            guardId: true,
                            occurredAt: true,
                            severity: true,
                        },
                    },
                },
            }),
        ]);
        const rowsByGuard = new Map();
        guards.forEach((guard) => {
            rowsByGuard.set(guard.id, {
                guardId: guard.id,
                name: guard.name,
                scheduledShifts: 0,
                attendanceRecords: 0,
                attendanceRate: null,
                lateCheckIns: 0,
                missedShifts: 0,
                incidentCount: 0,
            });
        });
        const pastScheduledByGuard = new Map();
        shifts
            .filter((shift) => shift.status !== 'cancelled')
            .forEach((shift) => {
            const isPast = shift.endTime.getTime() <= now.getTime();
            shift.assignments.forEach((assignment) => {
                const row = rowsByGuard.get(assignment.guardId);
                if (!row)
                    return;
                row.scheduledShifts += 1;
                const checkIn = shift.attendanceEvents.find((event) => event.guardId === assignment.guardId && event.type === 'CHECK_IN');
                if (checkIn) {
                    row.attendanceRecords += 1;
                    if (this.isLateCheckIn(checkIn.timestamp, shift.startTime)) {
                        row.lateCheckIns += 1;
                    }
                }
                if (isPast) {
                    pastScheduledByGuard.set(assignment.guardId, (pastScheduledByGuard.get(assignment.guardId) || 0) + 1);
                    if (!checkIn) {
                        row.missedShifts += 1;
                    }
                }
            });
            shift.incidents.forEach((incident) => {
                if (!this.isCurrentPeriod(incident.occurredAt, now))
                    return;
                const row = rowsByGuard.get(incident.guardId);
                if (row)
                    row.incidentCount += 1;
            });
        });
        const rows = Array.from(rowsByGuard.values())
            .map((guard) => {
            const pastScheduled = pastScheduledByGuard.get(guard.guardId) || 0;
            return {
                ...guard,
                attendanceRate: pastScheduled > 0
                    ? this.roundPercent(((pastScheduled - guard.missedShifts) / pastScheduled) * 100)
                    : null,
            };
        })
            .sort((a, b) => b.missedShifts - a.missedShifts ||
            b.lateCheckIns - a.lateCheckIns ||
            b.attendanceRecords - a.attendanceRecords ||
            a.name.localeCompare(b.name));
        const totalPastScheduled = Array.from(pastScheduledByGuard.values()).reduce((sum, value) => sum + value, 0);
        const totalMissed = rows.reduce((sum, guard) => sum + guard.missedShifts, 0);
        const attendanceRate = totalPastScheduled > 0
            ? this.roundPercent(((totalPastScheduled - totalMissed) / totalPastScheduled) * 100)
            : null;
        const totalLate = rows.reduce((sum, guard) => sum + guard.lateCheckIns, 0);
        const totalIncidents = rows.reduce((sum, guard) => sum + guard.incidentCount, 0);
        const perfectAttendanceGuard = rows.find((guard) => guard.attendanceRate === 100 &&
            (pastScheduledByGuard.get(guard.guardId) || 0) > 0);
        const missedShiftGuard = rows.find((guard) => guard.missedShifts > 0);
        const lateGuard = rows.find((guard) => guard.lateCheckIns > 0);
        const insights = [];
        if (perfectAttendanceGuard) {
            insights.push({
                id: 'guards-perfect-attendance',
                category: 'guards',
                severity: 'positive',
                title: 'Perfect attendance',
                message: `${perfectAttendanceGuard.name} has 100% attendance this month.`,
                subject: perfectAttendanceGuard.name,
                metricLabel: 'Attendance',
                metricValue: '100%',
            });
        }
        if (missedShiftGuard) {
            insights.push({
                id: 'guards-missed-shifts',
                category: 'guards',
                severity: missedShiftGuard.missedShifts >= 3 ? 'critical' : 'warning',
                title: 'Missed shifts',
                message: `${missedShiftGuard.name} missed ${missedShiftGuard.missedShifts} scheduled shifts.`,
                subject: missedShiftGuard.name,
                metricLabel: 'Missed shifts',
                metricValue: missedShiftGuard.missedShifts,
            });
        }
        if (lateGuard) {
            insights.push({
                id: 'guards-late-check-ins',
                category: 'guards',
                severity: lateGuard.lateCheckIns >= 3 ? 'warning' : 'info',
                title: 'Late check-ins',
                message: `${lateGuard.name} has ${lateGuard.lateCheckIns} late check-ins this month.`,
                subject: lateGuard.name,
                metricLabel: 'Late check-ins',
                metricValue: lateGuard.lateCheckIns,
            });
        }
        if (insights.length === 0) {
            insights.push(this.emptyInsight('guards', 'Guard insights need attendance data'));
        }
        return {
            generatedAt: now.toISOString(),
            summary: [
                this.metric('Attendance rate', attendanceRate === null ? 'N/A' : `${attendanceRate}%`, 'Assigned past shifts', attendanceRate !== null && attendanceRate >= 95 ? 'positive' : 'warning'),
                this.metric('Late check-ins', totalLate, 'Current month', totalLate > 0 ? 'warning' : 'positive'),
                this.metric('Missed shifts', totalMissed, 'Current month', totalMissed > 0 ? 'critical' : 'positive'),
                this.metric('Incident involvement', totalIncidents, 'Current month', totalIncidents > 0 ? 'info' : 'positive'),
            ],
            insights,
            rows,
        };
    }
    async getSiteInsights(tenantId) {
        const now = new Date();
        const monthStart = this.startOfMonth(now);
        const [sites, shifts, incidents] = await Promise.all([
            this.prisma.site.findMany({
                where: { tenantId },
                select: {
                    id: true,
                    name: true,
                    address: true,
                    client: {
                        select: {
                            name: true,
                            companyName: true,
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.shift.findMany({
                where: {
                    tenantId,
                    startTime: { gte: monthStart },
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
                        },
                    },
                },
            }),
            this.prisma.incident.findMany({
                where: {
                    tenantId,
                    occurredAt: { gte: monthStart },
                },
                select: {
                    siteId: true,
                    severity: true,
                },
            }),
        ]);
        const rowsBySite = new Map();
        sites.forEach((site) => {
            rowsBySite.set(site.id, {
                siteId: site.id,
                name: site.name,
                clientName: site.client ? this.clientDisplayName(site.client) : null,
                scheduledShifts: 0,
                incidentCount: 0,
                incidentRate: 0,
                coverageIssues: 0,
                shortageSlots: 0,
                attendanceRate: null,
                assignedPast: 0,
                attendedPast: 0,
            });
        });
        shifts
            .filter((shift) => shift.status !== 'cancelled')
            .forEach((shift) => {
            const row = rowsBySite.get(shift.siteId);
            if (!row)
                return;
            row.scheduledShifts += 1;
            const assignedCount = shift.assignments.length;
            if (assignedCount < shift.requiredGuards) {
                row.coverageIssues += 1;
                row.shortageSlots += shift.requiredGuards - assignedCount;
            }
            if (shift.endTime.getTime() <= now.getTime()) {
                shift.assignments.forEach((assignment) => {
                    row.assignedPast += 1;
                    if (shift.attendanceEvents.some((event) => event.guardId === assignment.guardId &&
                        event.type === 'CHECK_IN')) {
                        row.attendedPast += 1;
                    }
                });
            }
        });
        incidents.forEach((incident) => {
            const row = rowsBySite.get(incident.siteId);
            if (row)
                row.incidentCount += 1;
        });
        const rows = Array.from(rowsBySite.values())
            .map((site) => {
            const { assignedPast, attendedPast, ...row } = site;
            return {
                ...row,
                incidentRate: row.scheduledShifts > 0
                    ? this.roundPercent((row.incidentCount / row.scheduledShifts) * 100)
                    : 0,
                attendanceRate: assignedPast > 0
                    ? this.roundPercent((attendedPast / assignedPast) * 100)
                    : null,
            };
        })
            .sort((a, b) => b.incidentCount - a.incidentCount ||
            b.coverageIssues - a.coverageIssues ||
            a.name.localeCompare(b.name));
        const totalIncidents = rows.reduce((sum, site) => sum + site.incidentCount, 0);
        const totalCoverageIssues = rows.reduce((sum, site) => sum + site.coverageIssues, 0);
        const totalShortageSlots = rows.reduce((sum, site) => sum + site.shortageSlots, 0);
        const topIncidentSite = rows.find((site) => site.incidentCount > 0);
        const shortageSite = rows.find((site) => site.coverageIssues >= 2);
        const lowAttendanceSite = rows.find((site) => site.attendanceRate !== null && site.attendanceRate < 80);
        const insights = [];
        if (topIncidentSite) {
            insights.push({
                id: 'sites-highest-incident-rate',
                category: 'sites',
                severity: topIncidentSite.incidentCount >= 3 ? 'warning' : 'info',
                title: 'Highest incident rate',
                message: `${topIncidentSite.name} has the highest incident rate this month.`,
                subject: topIncidentSite.name,
                metricLabel: 'Incidents',
                metricValue: topIncidentSite.incidentCount,
            });
        }
        if (shortageSite) {
            insights.push({
                id: 'sites-staffing-shortage',
                category: 'sites',
                severity: shortageSite.coverageIssues >= 4 ? 'critical' : 'warning',
                title: 'Repeated staffing shortages',
                message: `${shortageSite.name} experienced repeated staffing shortages.`,
                subject: shortageSite.name,
                metricLabel: 'Coverage issues',
                metricValue: shortageSite.coverageIssues,
            });
        }
        if (lowAttendanceSite) {
            insights.push({
                id: 'sites-attendance-trend',
                category: 'sites',
                severity: 'warning',
                title: 'Attendance trend',
                message: `${lowAttendanceSite.name} has a ${lowAttendanceSite.attendanceRate}% guard check-in rate this month.`,
                subject: lowAttendanceSite.name,
                metricLabel: 'Check-in rate',
                metricValue: `${lowAttendanceSite.attendanceRate}%`,
            });
        }
        if (insights.length === 0) {
            insights.push(this.emptyInsight('sites', 'Site insights need shift data'));
        }
        return {
            generatedAt: now.toISOString(),
            summary: [
                this.metric('Active sites', sites.length, 'Tenant sites', 'info'),
                this.metric('Site incidents', totalIncidents, 'Current month', totalIncidents > 0 ? 'warning' : 'positive'),
                this.metric('Coverage issues', totalCoverageIssues, `${totalShortageSlots} open guard slots`, totalCoverageIssues > 0 ? 'warning' : 'positive'),
                this.metric('Scheduled shifts', shifts.length, 'Current month', shifts.length > 0 ? 'info' : 'warning'),
            ],
            insights,
            rows,
        };
    }
    async getBillingInsights(tenantId) {
        const now = new Date();
        const invoices = await this.prisma.invoice.findMany({
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
                        name: true,
                        companyName: true,
                    },
                },
                disputes: {
                    select: {
                        id: true,
                        status: true,
                        createdAt: true,
                    },
                },
            },
            orderBy: [{ issuedAt: 'desc' }, { createdAt: 'desc' }],
        });
        const rowsByClient = new Map();
        invoices.forEach((invoice) => {
            if (!rowsByClient.has(invoice.clientId)) {
                rowsByClient.set(invoice.clientId, {
                    clientId: invoice.clientId,
                    name: invoice.client ? this.clientDisplayName(invoice.client) : 'Unknown client',
                    revenue: 0,
                    paidAmount: 0,
                    outstandingAmount: 0,
                    disputedAmount: 0,
                    invoiceCount: 0,
                });
            }
            const row = rowsByClient.get(invoice.clientId);
            if (!row)
                return;
            row.invoiceCount += 1;
            if (REVENUE_STATUSES.includes(invoice.status)) {
                row.revenue = this.roundCurrency(row.revenue + invoice.totalAmount);
            }
            if (invoice.status === 'paid') {
                row.paidAmount = this.roundCurrency(row.paidAmount + invoice.totalAmount);
            }
            if (OUTSTANDING_STATUSES.includes(invoice.status)) {
                row.outstandingAmount = this.roundCurrency(row.outstandingAmount + invoice.totalAmount);
            }
            if (this.isDisputedInvoice(invoice)) {
                row.disputedAmount = this.roundCurrency(row.disputedAmount + invoice.totalAmount);
            }
        });
        const rows = Array.from(rowsByClient.values()).sort((a, b) => b.outstandingAmount - a.outstandingAmount ||
            b.revenue - a.revenue ||
            a.name.localeCompare(b.name));
        const lifecycleInvoices = invoices.filter((invoice) => REVENUE_STATUSES.includes(invoice.status));
        const outstandingInvoices = invoices.filter((invoice) => OUTSTANDING_STATUSES.includes(invoice.status));
        const disputedInvoices = invoices.filter((invoice) => this.isDisputedInvoice(invoice));
        const paidInvoices = invoices.filter((invoice) => invoice.status === 'paid' && invoice.paidAt);
        const invoicesOlderThan30 = lifecycleInvoices.filter((invoice) => this.daysSince(this.invoiceDueOrIssueDate(invoice), now) > 30);
        const unpaidOlderThan30 = invoicesOlderThan30.filter((invoice) => invoice.status !== 'paid');
        const unpaidAfter30Rate = invoicesOlderThan30.length > 0
            ? this.roundPercent((unpaidOlderThan30.length / invoicesOlderThan30.length) * 100)
            : 0;
        const paidDurations = paidInvoices.map((invoice) => this.daysBetween(this.invoiceDate(invoice), invoice.paidAt || now));
        const averagePaymentDays = paidDurations.length > 0
            ? this.roundNumber(paidDurations.reduce((sum, value) => sum + value, 0) /
                paidDurations.length, 1)
            : null;
        const outstandingAmount = this.roundCurrency(outstandingInvoices.reduce((sum, invoice) => sum + invoice.totalAmount, 0));
        const disputedAmount = this.roundCurrency(disputedInvoices.reduce((sum, invoice) => sum + invoice.totalAmount, 0));
        const paidAmount = this.roundCurrency(paidInvoices.reduce((sum, invoice) => sum + invoice.totalAmount, 0));
        const topOutstandingClient = rows.find((client) => client.outstandingAmount > 0);
        const insights = [];
        if (invoicesOlderThan30.length > 0) {
            insights.push({
                id: 'billing-unpaid-after-30',
                category: 'billing',
                severity: unpaidAfter30Rate >= 25 ? 'warning' : 'info',
                title: 'Unpaid after 30 days',
                message: `${unpaidAfter30Rate}% of invoices remain unpaid after 30 days.`,
                metricLabel: 'Unpaid rate',
                metricValue: `${unpaidAfter30Rate}%`,
            });
        }
        if (topOutstandingClient) {
            insights.push({
                id: 'billing-top-outstanding-client',
                category: 'billing',
                severity: 'warning',
                title: 'Largest outstanding balance',
                message: `${topOutstandingClient.name} has the highest outstanding balance.`,
                subject: topOutstandingClient.name,
                metricLabel: 'Outstanding',
                metricValue: this.formatCurrency(topOutstandingClient.outstandingAmount),
            });
        }
        if (disputedInvoices.length > 0) {
            insights.push({
                id: 'billing-disputed-invoices',
                category: 'billing',
                severity: disputedInvoices.length >= 3 ? 'warning' : 'info',
                title: 'Disputed invoices',
                message: `${disputedInvoices.length} invoices are currently disputed or under dispute review.`,
                metricLabel: 'Disputed',
                metricValue: disputedInvoices.length,
            });
        }
        if (averagePaymentDays !== null) {
            insights.push({
                id: 'billing-payment-speed',
                category: 'billing',
                severity: averagePaymentDays <= 14 ? 'positive' : 'info',
                title: 'Payment trend',
                message: `Paid invoices are collected in ${averagePaymentDays} days on average.`,
                metricLabel: 'Avg days to pay',
                metricValue: averagePaymentDays,
            });
        }
        if (insights.length === 0) {
            insights.push(this.emptyInsight('billing', 'Billing insights need invoice data'));
        }
        return {
            generatedAt: now.toISOString(),
            summary: [
                this.metric('Outstanding', this.formatCurrency(outstandingAmount), `${outstandingInvoices.length} invoices`, outstandingAmount > 0 ? 'warning' : 'positive'),
                this.metric('Disputed', this.formatCurrency(disputedAmount), `${disputedInvoices.length} invoices`, disputedAmount > 0 ? 'warning' : 'positive'),
                this.metric('Paid', this.formatCurrency(paidAmount), `${paidInvoices.length} invoices`, paidAmount > 0 ? 'positive' : 'info'),
                this.metric('Unpaid after 30 days', `${unpaidAfter30Rate}%`, `${unpaidOlderThan30.length} invoices`, unpaidAfter30Rate > 0 ? 'warning' : 'positive'),
            ],
            insights,
            rows,
        };
    }
    async getIncidentInsights(tenantId, userId) {
        const now = new Date();
        const analysisStart = new Date(now);
        analysisStart.setUTCDate(analysisStart.getUTCDate() - INCIDENT_ANALYSIS_DAYS);
        const recentStart = new Date(now);
        recentStart.setUTCDate(recentStart.getUTCDate() - RECENT_INCIDENT_DAYS);
        const incidents = await this.prisma.incident.findMany({
            where: {
                tenantId,
                occurredAt: { gte: analysisStart },
            },
            select: {
                id: true,
                title: true,
                description: true,
                severity: true,
                status: true,
                occurredAt: true,
                site: {
                    select: {
                        id: true,
                        name: true,
                        clientId: true,
                        client: {
                            select: {
                                id: true,
                                name: true,
                                companyName: true,
                            },
                        },
                    },
                },
                guard: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
                shift: {
                    select: {
                        id: true,
                        startTime: true,
                        endTime: true,
                    },
                },
            },
            orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
        });
        const severityBreakdown = this.buildSeverityBreakdown(incidents);
        const typeCounts = new Map();
        const dayCounts = new Map();
        const timeCounts = new Map();
        const siteRisks = new Map();
        const clientRisks = new Map();
        const guardRisks = new Map();
        incidents.forEach((incident) => {
            const score = this.incidentSeverityScore(incident.severity);
            const incidentType = this.incidentType(incident.title, incident.description);
            this.incrementTrend(typeCounts, incidentType, score);
            this.incrementTrend(dayCounts, this.incidentDayLabel(incident.occurredAt), score);
            this.incrementTrend(timeCounts, this.incidentTimeBucket(incident.occurredAt), score);
            this.addIncidentRisk(siteRisks, {
                entityId: incident.site.id,
                entityType: 'site',
                name: incident.site.name,
                relatedName: incident.site.client ? this.clientDisplayName(incident.site.client) : null,
                incident,
                incidentType,
                recentStart,
            });
            if (incident.site.client) {
                this.addIncidentRisk(clientRisks, {
                    entityId: incident.site.client.id,
                    entityType: 'client',
                    name: this.clientDisplayName(incident.site.client),
                    incident,
                    incidentType,
                    recentStart,
                });
            }
            this.addIncidentRisk(guardRisks, {
                entityId: incident.guard.id,
                entityType: 'guard',
                name: incident.guard.name,
                relatedName: incident.site.name,
                incident,
                incidentType,
                recentStart,
            });
        });
        const highRiskSites = this.buildIncidentRiskRows(siteRisks).slice(0, 5);
        const clientRiskRows = this.buildIncidentRiskRows(clientRisks).slice(0, 5);
        const guardRiskRows = this.buildIncidentRiskRows(guardRisks).slice(0, 5);
        const recurringIncidentTypes = this.buildIncidentTrendRows(typeCounts, 'incident_type', 'Incident type')
            .filter((trend) => trend.count > 1)
            .slice(0, 6);
        const timePatterns = [
            ...this.buildIncidentTrendRows(dayCounts, 'day_pattern', 'Day pattern')
                .filter((trend) => trend.count > 1)
                .slice(0, 3),
            ...this.buildIncidentTrendRows(timeCounts, 'time_pattern', 'Time pattern')
                .filter((trend) => trend.count > 1)
                .slice(0, 3),
        ].slice(0, 6);
        const recommendations = await this.aiMonitoringService.applyFeedbackToRecommendations(tenantId, this.buildIncidentRecommendations({
            highRiskSites,
            clientRisks: clientRiskRows,
            guardRisks: guardRiskRows,
            recurringIncidentTypes,
            timePatterns,
        }));
        const aiSummary = await this.buildIncidentAiSummary({
            tenantId,
            severityBreakdown,
            highRiskSites,
            clientRisks: clientRiskRows,
            guardRisks: guardRiskRows,
            recurringIncidentTypes,
            timePatterns,
            recommendations,
        });
        const fallbackSummary = this.fallbackIncidentSummary({
            totalIncidents: incidents.length,
            highRiskSites,
            recurringIncidentTypes,
            timePatterns,
        });
        const insights = this.buildIncidentInsights({
            totalIncidents: incidents.length,
            highRiskSites,
            clientRisks: clientRiskRows,
            guardRisks: guardRiskRows,
            recurringIncidentTypes,
            timePatterns,
        });
        const criticalCount = incidents.filter((incident) => this.normalizeSeverity(incident.severity) === 'critical').length;
        const highCount = incidents.filter((incident) => this.normalizeSeverity(incident.severity) === 'high').length;
        const recentCount = incidents.filter((incident) => incident.occurredAt >= recentStart).length;
        const response = {
            generatedAt: now.toISOString(),
            source: aiSummary ? 'ai_assisted' : 'rule_based',
            summary: [
                this.metric('Incidents analyzed', incidents.length, `Last ${INCIDENT_ANALYSIS_DAYS} days`, incidents.length > 0 ? 'info' : 'positive'),
                this.metric('Critical/high', criticalCount + highCount, `${criticalCount} critical, ${highCount} high`, criticalCount > 0 ? 'critical' : highCount > 0 ? 'warning' : 'positive'),
                this.metric('Recent incidents', recentCount, `Last ${RECENT_INCIDENT_DAYS} days`, recentCount >= 2 ? 'warning' : 'info'),
                this.metric('High-risk sites', highRiskSites.filter((site) => ['critical', 'high'].includes(site.riskLevel)).length, 'Risk score 50+', highRiskSites.some((site) => site.riskLevel === 'critical') ? 'critical' : 'warning'),
            ],
            aiSummary: aiSummary || fallbackSummary,
            insights,
            severityBreakdown,
            highRiskSites,
            clientRisks: clientRiskRows,
            guardRisks: guardRiskRows,
            recurringIncidentTypes,
            timePatterns,
            recommendations,
        };
        const generation = await this.aiMonitoringService.logGeneration({
            tenantId,
            createdBy: userId,
            promptVersion: DEFAULT_PROMPT_VERSION,
            promptKey: 'incident_risk_summary',
            modelUsed: this.aiService.getModelName(),
            sourceModule: 'ai_insights.incident_risk',
            generatedOutput: response,
            fallbackUsed: !aiSummary,
            status: aiSummary ? 'success' : 'fallback',
        });
        return {
            ...response,
            aiGenerationId: generation?.id,
            recommendations: this.aiMonitoringService.attachGenerationId(response.recommendations, generation?.id),
        };
    }
    buildSeverityBreakdown(incidents) {
        const total = incidents.length;
        const counts = new Map();
        incidents.forEach((incident) => {
            const severity = this.normalizeSeverity(incident.severity);
            counts.set(severity, (counts.get(severity) || 0) + 1);
        });
        return INCIDENT_SEVERITY_ORDER.map((severity) => {
            const count = counts.get(severity) || 0;
            return {
                severity,
                count,
                percent: total > 0 ? this.roundPercent((count / total) * 100) : 0,
            };
        });
    }
    addIncidentRisk(risks, input) {
        if (!risks.has(input.entityId)) {
            risks.set(input.entityId, {
                entityId: input.entityId,
                entityType: input.entityType,
                name: input.name,
                relatedName: input.relatedName,
                score: 0,
                incidentCount: 0,
                criticalCount: 0,
                highCount: 0,
                recent7DayCount: 0,
                typeCounts: new Map(),
                lastIncidentAt: null,
            });
        }
        const risk = risks.get(input.entityId);
        if (!risk)
            return;
        const severity = this.normalizeSeverity(input.incident.severity);
        risk.score += this.incidentSeverityScore(severity);
        risk.incidentCount += 1;
        risk.criticalCount += severity === 'critical' ? 1 : 0;
        risk.highCount += severity === 'high' ? 1 : 0;
        risk.recent7DayCount += input.incident.occurredAt >= input.recentStart ? 1 : 0;
        risk.typeCounts.set(input.incidentType, (risk.typeCounts.get(input.incidentType) || 0) + 1);
        if (!risk.lastIncidentAt || input.incident.occurredAt > risk.lastIncidentAt) {
            risk.lastIncidentAt = input.incident.occurredAt;
        }
    }
    buildIncidentRiskRows(risks) {
        return Array.from(risks.values())
            .map((risk) => {
            const repeatedTypes = Array.from(risk.typeCounts.entries()).filter(([, count]) => count > 1);
            let score = risk.score;
            const indicators = [];
            if (risk.criticalCount > 0) {
                indicators.push(`${risk.criticalCount} critical incident${risk.criticalCount === 1 ? '' : 's'}`);
            }
            if (risk.highCount > 0) {
                indicators.push(`${risk.highCount} high severity incident${risk.highCount === 1 ? '' : 's'}`);
            }
            if (repeatedTypes.length > 0) {
                score += risk.entityType === 'site' ? 15 : 10;
                indicators.push(`Repeated ${repeatedTypes[0][0].toLowerCase()} incidents`);
            }
            if (risk.recent7DayCount >= 2) {
                score += 20;
                indicators.push(`${risk.recent7DayCount} incidents in the last ${RECENT_INCIDENT_DAYS} days`);
            }
            if (risk.incidentCount >= 5) {
                score += 10;
                indicators.push(`${risk.incidentCount} incidents in the analysis window`);
            }
            if (indicators.length === 0 && risk.incidentCount > 0) {
                indicators.push(`${risk.incidentCount} incident${risk.incidentCount === 1 ? '' : 's'} logged`);
            }
            const riskScore = this.roundRiskScore(score);
            return {
                entityId: risk.entityId,
                entityType: risk.entityType,
                name: risk.name,
                relatedName: risk.relatedName,
                riskScore,
                riskLevel: this.riskLevel(riskScore),
                incidentCount: risk.incidentCount,
                criticalCount: risk.criticalCount,
                highCount: risk.highCount,
                recent7DayCount: risk.recent7DayCount,
                repeatedIncidentTypes: repeatedTypes.length,
                lastIncidentAt: risk.lastIncidentAt?.toISOString() ?? null,
                indicators,
            };
        })
            .sort((left, right) => right.riskScore - left.riskScore || right.incidentCount - left.incidentCount || left.name.localeCompare(right.name));
    }
    incrementTrend(trends, label, score) {
        const current = trends.get(label) || { count: 0, riskScore: 0 };
        trends.set(label, {
            count: current.count + 1,
            riskScore: current.riskScore + score,
        });
    }
    buildIncidentTrendRows(trends, type, detailPrefix) {
        return Array.from(trends.entries())
            .map(([label, trend]) => ({
            id: `${type}-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
            label,
            type,
            count: trend.count,
            riskScore: this.roundRiskScore(trend.riskScore),
            detail: `${detailPrefix} seen ${trend.count} time${trend.count === 1 ? '' : 's'}.`,
        }))
            .sort((left, right) => right.count - left.count || right.riskScore - left.riskScore || left.label.localeCompare(right.label));
    }
    buildIncidentInsights(input) {
        const insights = [];
        const topSite = input.highRiskSites[0];
        const topClient = input.clientRisks[0];
        const topGuard = input.guardRisks[0];
        const topType = input.recurringIncidentTypes[0];
        const topTimePattern = input.timePatterns[0];
        if (topSite) {
            insights.push({
                id: 'incidents-high-risk-site',
                category: 'incidents',
                severity: this.riskLevelToSeverity(topSite.riskLevel),
                title: 'High-risk site',
                message: `${topSite.name} has the highest incident risk score at ${topSite.riskScore}.`,
                subject: topSite.name,
                metricLabel: 'Risk score',
                metricValue: topSite.riskScore,
            });
        }
        if (topClient && topClient.riskScore >= 25) {
            insights.push({
                id: 'incidents-client-risk',
                category: 'incidents',
                severity: this.riskLevelToSeverity(topClient.riskLevel),
                title: 'Client risk concentration',
                message: `${topClient.name} has elevated incident exposure across assigned sites.`,
                subject: topClient.name,
                metricLabel: 'Risk score',
                metricValue: topClient.riskScore,
            });
        }
        if (topGuard && topGuard.riskScore >= 25) {
            insights.push({
                id: 'incidents-guard-risk',
                category: 'incidents',
                severity: this.riskLevelToSeverity(topGuard.riskLevel),
                title: 'Guard involvement indicator',
                message: `${topGuard.name} is linked to the highest guard-side incident risk score.`,
                subject: topGuard.name,
                metricLabel: 'Risk score',
                metricValue: topGuard.riskScore,
            });
        }
        if (topType) {
            insights.push({
                id: 'incidents-recurring-type',
                category: 'incidents',
                severity: topType.riskScore >= 50 ? 'warning' : 'info',
                title: 'Recurring incident type',
                message: `${topType.label} appeared ${topType.count} times in the incident window.`,
                subject: topType.label,
                metricLabel: 'Occurrences',
                metricValue: topType.count,
            });
        }
        if (topTimePattern) {
            insights.push({
                id: 'incidents-time-pattern',
                category: 'incidents',
                severity: topTimePattern.count >= 3 ? 'warning' : 'info',
                title: 'Time pattern',
                message: `${topTimePattern.label} has a repeated incident pattern.`,
                subject: topTimePattern.label,
                metricLabel: 'Occurrences',
                metricValue: topTimePattern.count,
            });
        }
        if (insights.length === 0) {
            insights.push({
                id: 'incidents-empty',
                category: 'incidents',
                severity: 'positive',
                title: 'No incident risk detected',
                message: input.totalIncidents === 0
                    ? 'No incidents were found in the analysis window.'
                    : 'No recurring high-risk incident patterns were detected.',
            });
        }
        return insights;
    }
    buildIncidentRecommendations(input) {
        const recommendations = [];
        const topSite = input.highRiskSites.find((site) => site.riskScore >= 25);
        const topClient = input.clientRisks.find((client) => client.riskScore >= 40);
        const topGuard = input.guardRisks.find((guard) => guard.riskScore >= 40);
        const repeatedType = input.recurringIncidentTypes[0];
        const nightPattern = input.timePatterns.find((pattern) => pattern.label === 'Night');
        if (topSite) {
            recommendations.push({
                id: 'incident-risk-site-supervision',
                category: 'incidents',
                priority: topSite.riskScore >= 80 ? 'high' : 'medium',
                title: 'Increase site supervision',
                action: `Increase supervision at ${topSite.name}.`,
                reason: `${topSite.name} has a risk score of ${topSite.riskScore} from ${topSite.incidentCount} incidents.`,
                source: 'rule',
                actionType: 'flag_site_risk',
                targetModule: 'site',
                targetEntityId: topSite.entityId,
            });
            recommendations.push({
                id: 'incident-risk-site-post-orders',
                category: 'incidents',
                priority: 'medium',
                title: 'Review post orders',
                action: `Review post orders for ${topSite.name}.`,
                reason: topSite.indicators[0] || 'The site has recurring incident risk indicators.',
                source: 'rule',
                actionType: 'create_follow_up_task',
                targetModule: 'site',
                targetEntityId: topSite.entityId,
            });
        }
        if (repeatedType) {
            recommendations.push({
                id: 'incident-risk-recurring-type',
                category: 'incidents',
                priority: repeatedType.riskScore >= 50 ? 'high' : 'medium',
                title: 'Investigate recurring incidents',
                action: `Investigate repeated ${repeatedType.label.toLowerCase()} incidents.`,
                reason: `${repeatedType.label} appeared ${repeatedType.count} times in the analysis window.`,
                source: 'rule',
                actionType: 'create_follow_up_task',
                targetModule: 'incident',
            });
        }
        if (nightPattern) {
            recommendations.push({
                id: 'incident-risk-night-coverage',
                category: 'incidents',
                priority: nightPattern.count >= 3 ? 'high' : 'medium',
                title: 'Adjust night coverage',
                action: 'Add extra guard coverage during night shift.',
                reason: `${nightPattern.count} incidents occurred during the night window.`,
                source: 'rule',
                actionType: 'create_follow_up_task',
                targetModule: 'operations',
            });
        }
        if (topGuard) {
            recommendations.push({
                id: 'incident-risk-guard-review',
                category: 'incidents',
                priority: topGuard.riskScore >= 80 ? 'high' : 'medium',
                title: 'Review guard incident involvement',
                action: `Review incident involvement with ${topGuard.name}.`,
                reason: `${topGuard.name} has a guard risk score of ${topGuard.riskScore}.`,
                source: 'rule',
                actionType: 'suggest_guard_reassignment',
                targetModule: 'guard',
                targetEntityId: topGuard.entityId,
            });
        }
        if (topClient) {
            recommendations.push({
                id: 'incident-risk-client-scope',
                category: 'incidents',
                priority: topClient.riskScore >= 80 ? 'high' : 'medium',
                title: 'Review client risk scope',
                action: `Review service scope and risk controls with ${topClient.name}.`,
                reason: `${topClient.name} has a client risk score of ${topClient.riskScore}.`,
                source: 'rule',
                actionType: 'flag_client_risk',
                targetModule: 'client',
                targetEntityId: topClient.entityId,
            });
        }
        if (recommendations.length === 0) {
            recommendations.push({
                id: 'incident-risk-monitoring',
                category: 'incidents',
                priority: 'low',
                title: 'Maintain incident review cadence',
                action: 'Keep reviewing incident trends weekly.',
                reason: 'No elevated incident risk pattern was detected in the current analysis window.',
                source: 'rule',
                actionType: 'create_follow_up_task',
                targetModule: 'incident',
            });
        }
        return recommendations.slice(0, 8);
    }
    async buildIncidentAiSummary(input) {
        try {
            const promptTemplate = await this.resolvePromptTemplate(input.tenantId, 'ai_insights.incident_risk', 'incident_risk_summary');
            return await this.aiService.generateIncidentRiskSummary(JSON.stringify({
                severityBreakdown: input.severityBreakdown,
                highRiskSites: input.highRiskSites.slice(0, 3),
                clientRisks: input.clientRisks.slice(0, 3),
                guardRisks: input.guardRisks.slice(0, 3),
                recurringIncidentTypes: input.recurringIncidentTypes.slice(0, 5),
                timePatterns: input.timePatterns.slice(0, 5),
                recommendations: input.recommendations.map((recommendation) => recommendation.action),
            }), promptTemplate);
        }
        catch (error) {
            this.logger.warn(`Incident AI summary skipped: ${error instanceof Error ? error.message : String(error)}`);
            return null;
        }
    }
    fallbackIncidentSummary(input) {
        if (input.totalIncidents === 0) {
            return `No incidents were found in the last ${INCIDENT_ANALYSIS_DAYS} days. Keep monitoring new incident reports and review risk weekly.`;
        }
        const topSite = input.highRiskSites[0];
        const topType = input.recurringIncidentTypes[0];
        const topPattern = input.timePatterns[0];
        return [
            `${input.totalIncidents} incidents were analyzed over the last ${INCIDENT_ANALYSIS_DAYS} days.`,
            topSite ? `${topSite.name} is the highest-risk site with a score of ${topSite.riskScore}.` : null,
            topType ? `${topType.label} is the most repeated incident type.` : null,
            topPattern ? `${topPattern.label} shows the strongest time pattern.` : null,
        ].filter(Boolean).join(' ');
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
            return 'Access control';
        if (/(parking|vehicle|car|traffic|accident)/.test(text))
            return 'Vehicle or parking';
        if (/(equipment|camera|cctv|radio|device|system)/.test(text))
            return 'Equipment issue';
        if (/(shortage|uncovered|coverage|absent|no guard|staff)/.test(text))
            return 'Coverage issue';
        const normalized = `${title || description || 'General incident'}`
            .trim()
            .replace(/\s+/g, ' ')
            .slice(0, 64);
        return normalized || 'General incident';
    }
    incidentDayLabel(date) {
        return date.toLocaleString('en-US', {
            weekday: 'long',
            timeZone: 'UTC',
        });
    }
    incidentTimeBucket(date) {
        const hour = date.getUTCHours();
        if (hour < 6)
            return 'Night';
        if (hour < 12)
            return 'Morning';
        if (hour < 18)
            return 'Afternoon';
        return 'Evening';
    }
    normalizeSeverity(severity) {
        const normalized = (severity || '').toLowerCase();
        return INCIDENT_SEVERITY_SCORES[normalized] ? normalized : 'low';
    }
    incidentSeverityScore(severity) {
        return INCIDENT_SEVERITY_SCORES[this.normalizeSeverity(severity)] || 5;
    }
    roundRiskScore(score) {
        return Math.max(0, Math.min(100, Math.round(score)));
    }
    riskLevel(score) {
        if (score >= 80)
            return 'critical';
        if (score >= 50)
            return 'high';
        if (score >= 25)
            return 'medium';
        return 'low';
    }
    riskLevelToSeverity(riskLevel) {
        if (riskLevel === 'critical')
            return 'critical';
        if (riskLevel === 'high')
            return 'warning';
        if (riskLevel === 'medium')
            return 'info';
        return 'positive';
    }
    buildOverview(clients, guards, sites, billing, recommendations) {
        const insights = [
            ...clients.insights,
            ...guards.insights,
            ...sites.insights,
            ...billing.insights,
        ];
        const priorityInsights = insights.filter((insight) => ['critical', 'warning'].includes(insight.severity));
        return {
            summary: [
                this.metric('Active clients', this.metricValue(clients, 'Active clients'), 'Current tenant', 'info'),
                this.metric('Guard attendance', this.metricValue(guards, 'Attendance rate'), 'This month', 'info'),
                this.metric('Coverage issues', this.metricValue(sites, 'Coverage issues'), 'Open guard slots', this.metricValue(sites, 'Coverage issues') === 0 ? 'positive' : 'warning'),
                this.metric('Recommendations', recommendations.length, 'Ready for admin review', recommendations.length > 0 ? 'info' : 'positive'),
            ],
            insights: (priorityInsights.length > 0 ? priorityInsights : insights).slice(0, 6),
        };
    }
    buildRuleRecommendations(clients, guards, sites, billing) {
        const recommendations = [];
        const highestIncidentSite = sites.rows.find((site) => site.incidentCount > 0);
        const shortageSite = sites.rows.find((site) => site.coverageIssues >= 2);
        const missedShiftGuard = guards.rows.find((guard) => guard.missedShifts > 0);
        const highIncidentClient = clients.rows.find((client) => client.incidentCount >= 2);
        const topOutstandingClient = billing.rows.find((client) => client.outstandingAmount > 0);
        const disputedClient = billing.rows.find((client) => client.disputedAmount > 0);
        if (highestIncidentSite) {
            recommendations.push({
                id: 'rule-site-incident-staffing',
                category: 'sites',
                priority: highestIncidentSite.incidentCount >= 3 ? 'high' : 'medium',
                title: 'Review site risk controls',
                action: `Increase staffing or supervision at ${highestIncidentSite.name}.`,
                reason: `${highestIncidentSite.name} has ${highestIncidentSite.incidentCount} incident reports this month.`,
                source: 'rule',
                actionType: 'flag_site_risk',
                targetModule: 'site',
                targetEntityId: highestIncidentSite.siteId,
            });
        }
        if (shortageSite) {
            recommendations.push({
                id: 'rule-site-coverage',
                category: 'sites',
                priority: shortageSite.coverageIssues >= 4 ? 'high' : 'medium',
                title: 'Close coverage gaps',
                action: `Add backup coverage for ${shortageSite.name}.`,
                reason: `${shortageSite.coverageIssues} shifts were below required guard coverage.`,
                source: 'rule',
                actionType: 'flag_site_risk',
                targetModule: 'site',
                targetEntityId: shortageSite.siteId,
            });
        }
        if (missedShiftGuard) {
            recommendations.push({
                id: 'rule-guard-attendance',
                category: 'guards',
                priority: missedShiftGuard.missedShifts >= 3 ? 'high' : 'medium',
                title: 'Investigate missed shifts',
                action: `Review attendance with ${missedShiftGuard.name}.`,
                reason: `${missedShiftGuard.name} missed ${missedShiftGuard.missedShifts} scheduled shifts.`,
                source: 'rule',
                actionType: 'suggest_guard_reassignment',
                targetModule: 'guard',
                targetEntityId: missedShiftGuard.guardId,
            });
        }
        if (highIncidentClient) {
            recommendations.push({
                id: 'rule-client-contract-review',
                category: 'clients',
                priority: 'medium',
                title: 'Review service scope',
                action: `Review contract coverage with ${highIncidentClient.name}.`,
                reason: `${highIncidentClient.name} has ${highIncidentClient.incidentCount} incident reports this month.`,
                source: 'rule',
                actionType: 'flag_client_risk',
                targetModule: 'client',
                targetEntityId: highIncidentClient.clientId,
            });
        }
        if (topOutstandingClient) {
            recommendations.push({
                id: 'rule-billing-follow-up',
                category: 'billing',
                priority: topOutstandingClient.outstandingAmount >= 5000 ? 'high' : 'medium',
                title: 'Follow up unpaid invoices',
                action: `Follow up with ${topOutstandingClient.name} on unpaid invoices.`,
                reason: `${topOutstandingClient.name} has ${this.formatCurrency(topOutstandingClient.outstandingAmount)} outstanding.`,
                source: 'rule',
                actionType: 'create_invoice_followup',
                targetModule: 'client',
                targetEntityId: topOutstandingClient.clientId,
            });
        }
        if (disputedClient) {
            recommendations.push({
                id: 'rule-billing-disputes',
                category: 'billing',
                priority: 'medium',
                title: 'Resolve invoice disputes',
                action: `Prioritize dispute resolution for ${disputedClient.name}.`,
                reason: `${this.formatCurrency(disputedClient.disputedAmount)} is tied to disputed invoices.`,
                source: 'rule',
                actionType: 'create_invoice_followup',
                targetModule: 'client',
                targetEntityId: disputedClient.clientId,
            });
        }
        if (recommendations.length === 0) {
            recommendations.push({
                id: 'rule-maintain-cadence',
                category: 'operations',
                priority: 'low',
                title: 'Maintain operating cadence',
                action: 'Keep monitoring attendance, incidents, and invoice aging weekly.',
                reason: 'No high-risk patterns were detected in the available data.',
                source: 'rule',
                actionType: 'create_follow_up_task',
                targetModule: 'operations',
            });
        }
        return recommendations;
    }
    async buildAiRecommendations(tenantId, clients, guards, sites, billing, ruleRecommendations) {
        try {
            const feedbackSummary = await this.aiMonitoringService.getFeedbackSummaryForPrompt(tenantId);
            const context = {
                clientInsights: clients.insights.map((insight) => insight.message),
                guardInsights: guards.insights.map((insight) => insight.message),
                siteInsights: sites.insights.map((insight) => insight.message),
                billingInsights: billing.insights.map((insight) => insight.message),
                currentRecommendations: ruleRecommendations.map((item) => item.action),
                adminFeedbackHistory: feedbackSummary.summaryText,
            };
            const generated = await this.aiService.generateBusinessInsightRecommendations(JSON.stringify(context), await this.resolvePromptTemplate(tenantId, 'ai_insights.dashboard', 'business_recommendations'));
            if (!generated?.length) {
                return [];
            }
            return generated.slice(0, 4).map((action, index) => ({
                id: `ai-recommendation-${index + 1}`,
                category: 'operations',
                priority: index === 0 ? 'high' : 'medium',
                title: 'AI recommendation',
                action,
                reason: 'Generated from tenant-scoped operational and billing metrics.',
                source: 'ai',
                actionType: 'notify_admin',
                targetModule: 'ai_insights',
            }));
        }
        catch (error) {
            this.logger.warn(`AI recommendation generation skipped: ${error instanceof Error ? error.message : String(error)}`);
            return [];
        }
    }
    emptyInsight(category, title) {
        return {
            id: `${category}-empty`,
            category,
            severity: 'info',
            title,
            message: 'Generate shifts, attendance records, incidents, invoices, or contracts to unlock richer insights.',
        };
    }
    async resolvePromptTemplate(tenantId, moduleName, promptKey) {
        return (await this.aiGovernanceService?.resolvePromptVersion({
            tenantId,
            moduleName,
            promptKey,
            fallbackVersion: DEFAULT_PROMPT_VERSION,
        }))?.promptText ?? null;
    }
    metric(label, value, detail, tone) {
        return { label, value, detail, tone };
    }
    metricValue(section, label) {
        return section.summary.find((metric) => metric.label === label)?.value ?? 0;
    }
    clientDisplayName(client) {
        return client.companyName || client.name;
    }
    startOfMonth(date) {
        return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
    }
    monthLabel(date) {
        return date.toLocaleString('en-US', {
            month: 'long',
            year: 'numeric',
            timeZone: 'UTC',
        });
    }
    isCurrentPeriod(value, now) {
        const monthStart = this.startOfMonth(now);
        return value.getTime() >= monthStart.getTime() && value.getTime() <= now.getTime();
    }
    invoiceDate(invoice) {
        return invoice.issuedAt ?? invoice.createdAt;
    }
    invoiceDueOrIssueDate(invoice) {
        return invoice.dueDate ?? invoice.issuedAt ?? invoice.createdAt;
    }
    isLateCheckIn(checkInTime, shiftStartTime) {
        return (checkInTime.getTime() - shiftStartTime.getTime() >
            LATE_CHECK_IN_MINUTES * 60 * 1000);
    }
    isDisputedInvoice(invoice) {
        return (invoice.status === 'disputed' ||
            invoice.disputes.some((dispute) => ACTIVE_DISPUTE_STATUSES.includes(dispute.status)));
    }
    daysBetween(start, end) {
        return Math.max(0, Math.ceil((end.getTime() - start.getTime()) / MS_PER_DAY));
    }
    daysSince(date, now) {
        return this.daysBetween(date, now);
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
    formatCurrency(value) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            maximumFractionDigits: value >= 1000 ? 0 : 2,
        }).format(value);
    }
};
exports.AiInsightsService = AiInsightsService;
exports.AiInsightsService = AiInsightsService = AiInsightsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(3, (0, common_1.Optional)()),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        ai_service_1.AiService,
        ai_monitoring_service_1.AiMonitoringService,
        ai_governance_service_1.AiGovernanceService])
], AiInsightsService);
//# sourceMappingURL=ai-insights.service.js.map