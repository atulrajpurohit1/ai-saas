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
var SalesAcceleratorService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SalesAcceleratorService = void 0;
const common_1 = require("@nestjs/common");
const ai_service_1 = require("../ai/ai.service");
const ai_monitoring_service_1 = require("../ai-monitoring/ai-monitoring.service");
const audit_service_1 = require("../audit/audit.service");
const activities_service_1 = require("../activities/activities.service");
const prisma_service_1 = require("../prisma/prisma.service");
const proposals_service_1 = require("../proposals/proposals.service");
let SalesAcceleratorService = SalesAcceleratorService_1 = class SalesAcceleratorService {
    prisma;
    aiService;
    aiMonitoringService;
    auditService;
    activitiesService;
    proposalsService;
    logger = new common_1.Logger(SalesAcceleratorService_1.name);
    constructor(prisma, aiService, aiMonitoringService, auditService, activitiesService, proposalsService) {
        this.prisma = prisma;
        this.aiService = aiService;
        this.aiMonitoringService = aiMonitoringService;
        this.auditService = auditService;
        this.activitiesService = activitiesService;
        this.proposalsService = proposalsService;
    }
    async getDashboard(tenantId) {
        const postCloseLookback = this.daysAgo(90);
        const [leads, deals, recentAssessments, discoveryObjections, assessmentObjections, postCloseIncidents, postCloseShifts, postCloseInvoices, postCloseReports,] = await Promise.all([
            this.prisma.lead.findMany({
                where: { tenantId },
                select: {
                    id: true,
                    name: true,
                    company: true,
                    status: true,
                    createdAt: true,
                    discoverySessions: {
                        orderBy: { createdAt: 'desc' },
                        take: 1,
                        select: {
                            id: true,
                            propertyType: true,
                            buyerRole: true,
                            currentProvider: true,
                            guardCount: true,
                            serviceHours: true,
                            painPoints: true,
                            riskConcerns: true,
                            decisionTimeline: true,
                            budgetSensitivity: true,
                            objections: true,
                            notes: true,
                            createdAt: true,
                        },
                    },
                    salesAssessments: {
                        orderBy: { createdAt: 'desc' },
                        take: 1,
                        select: {
                            id: true,
                            leadScore: true,
                            priorityTier: true,
                            closeReadinessScore: true,
                            discoveryQualityScore: true,
                            riskProfile: true,
                            proposalAngle: true,
                            recommendedNextAction: true,
                            missingQuestions: true,
                            objectionRisks: true,
                            summary: true,
                            createdAt: true,
                        },
                    },
                },
            }),
            this.prisma.deal.findMany({
                where: { tenantId },
                select: {
                    id: true,
                    name: true,
                    stage: true,
                    createdAt: true,
                    lead: { select: { id: true, name: true, company: true } },
                    client: { select: { id: true, name: true, companyName: true } },
                    activities: {
                        orderBy: { createdAt: 'desc' },
                        take: 20,
                        select: {
                            id: true,
                            type: true,
                            subject: true,
                            status: true,
                            dueDate: true,
                            createdAt: true,
                        },
                    },
                    discoverySessions: {
                        orderBy: { createdAt: 'desc' },
                        take: 1,
                        select: {
                            id: true,
                            propertyType: true,
                            buyerRole: true,
                            currentProvider: true,
                            guardCount: true,
                            serviceHours: true,
                            painPoints: true,
                            riskConcerns: true,
                            decisionTimeline: true,
                            budgetSensitivity: true,
                            objections: true,
                            notes: true,
                            createdAt: true,
                        },
                    },
                    salesAssessments: {
                        orderBy: { createdAt: 'desc' },
                        take: 6,
                        select: {
                            id: true,
                            leadScore: true,
                            priorityTier: true,
                            closeReadinessScore: true,
                            discoveryQualityScore: true,
                            riskProfile: true,
                            proposalAngle: true,
                            recommendedNextAction: true,
                            missingQuestions: true,
                            objectionRisks: true,
                            summary: true,
                            createdAt: true,
                        },
                    },
                },
            }),
            this.prisma.salesAssessment.findMany({
                where: { tenantId },
                orderBy: { createdAt: 'desc' },
                take: 8,
                select: {
                    id: true,
                    assessmentType: true,
                    leadScore: true,
                    priorityTier: true,
                    closeReadinessScore: true,
                    summary: true,
                    recommendedNextAction: true,
                    createdAt: true,
                    lead: { select: { id: true, name: true, company: true } },
                    deal: { select: { id: true, name: true, stage: true } },
                },
            }),
            this.prisma.discoverySession.findMany({
                where: { tenantId },
                orderBy: { createdAt: 'desc' },
                take: 200,
                select: {
                    id: true,
                    objections: true,
                    createdAt: true,
                    lead: {
                        select: { id: true, name: true, company: true, status: true },
                    },
                    deal: {
                        select: {
                            id: true,
                            name: true,
                            stage: true,
                            lead: { select: { company: true } },
                        },
                    },
                },
            }),
            this.prisma.salesAssessment.findMany({
                where: { tenantId },
                orderBy: { createdAt: 'desc' },
                take: 200,
                select: {
                    id: true,
                    objectionRisks: true,
                    createdAt: true,
                    lead: {
                        select: { id: true, name: true, company: true, status: true },
                    },
                    deal: {
                        select: {
                            id: true,
                            name: true,
                            stage: true,
                            lead: { select: { company: true } },
                        },
                    },
                },
            }),
            this.prisma.incident.findMany({
                where: {
                    tenantId,
                    occurredAt: { gte: postCloseLookback },
                    site: { clientId: { not: null } },
                },
                select: {
                    id: true,
                    title: true,
                    severity: true,
                    status: true,
                    occurredAt: true,
                    site: { select: { clientId: true, name: true } },
                },
            }),
            this.prisma.shift.findMany({
                where: {
                    tenantId,
                    startTime: { gte: postCloseLookback },
                    site: { clientId: { not: null } },
                },
                select: {
                    id: true,
                    status: true,
                    requiredGuards: true,
                    startTime: true,
                    site: { select: { clientId: true, name: true } },
                    assignments: { select: { status: true } },
                },
            }),
            this.prisma.invoice.findMany({
                where: {
                    tenantId,
                    createdAt: { gte: postCloseLookback },
                },
                select: {
                    id: true,
                    status: true,
                    totalAmount: true,
                    dueDate: true,
                    clientId: true,
                },
            }),
            this.prisma.dailyServiceReport.findMany({
                where: {
                    tenantId,
                    reportDate: { gte: postCloseLookback },
                },
                select: {
                    id: true,
                    status: true,
                    reportDate: true,
                    clientId: true,
                },
            }),
        ]);
        const assessedLeads = leads
            .map((lead) => ({
            ...lead,
            assessment: lead.salesAssessments[0] ?? null,
            marketSignalProfile: this.marketSignalProfile({
                entityType: 'lead',
                lead,
                discovery: lead.discoverySessions[0] ?? null,
            }),
        }))
            .filter((lead) => lead.assessment);
        const dealsWithMomentum = deals.map((deal) => {
            const assessment = deal.salesAssessments[0] ?? null;
            const momentum = this.dealMomentum(deal, assessment);
            return {
                ...deal,
                assessment,
                momentum,
                forecast: this.dealForecast(deal, deal.salesAssessments, momentum),
                marketSignalProfile: this.marketSignalProfile({
                    entityType: 'deal',
                    lead: deal.lead,
                    deal,
                    discovery: deal.discoverySessions[0] ?? null,
                    assessment: assessment ? this.assessmentDraftFromRecord(assessment) : null,
                }),
            };
        });
        const assessedDeals = dealsWithMomentum.filter((deal) => deal.assessment);
        const topLeads = assessedLeads
            .sort((a, b) => (b.assessment?.leadScore ?? -1) - (a.assessment?.leadScore ?? -1))
            .slice(0, 5);
        const atRiskDeals = assessedDeals
            .sort((a, b) => (a.assessment?.closeReadinessScore ?? 101) -
            (b.assessment?.closeReadinessScore ?? 101))
            .slice(0, 5);
        const stalledDeals = dealsWithMomentum
            .filter((deal) => ['urgent', 'stalled'].includes(deal.momentum.status))
            .sort((a, b) => a.momentum.score - b.momentum.score)
            .slice(0, 5);
        const forecastRiskDeals = dealsWithMomentum
            .filter((deal) => ['at_risk', 'watch'].includes(deal.forecast.status))
            .sort((a, b) => a.forecast.confidence - b.forecast.confidence)
            .slice(0, 5);
        const missingDiscoveryLeads = leads
            .filter((lead) => lead.discoverySessions.length === 0)
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
            .slice(0, 8);
        const missingDiscoveryDeals = dealsWithMomentum
            .filter((deal) => deal.discoverySessions.length === 0)
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
            .slice(0, 8);
        const allObjectionPatterns = this.buildObjectionPatterns(discoveryObjections, assessmentObjections);
        const objectionPatterns = allObjectionPatterns.slice(0, 6);
        const trackedObjections = allObjectionPatterns.reduce((sum, pattern) => sum + pattern.count, 0);
        const postCloseContexts = this.buildPostCloseOperationContexts(postCloseIncidents, postCloseShifts, postCloseInvoices, postCloseReports);
        const allPostCloseFeedbackDeals = dealsWithMomentum
            .filter((deal) => this.isClosedWonStage(deal.stage) && deal.client)
            .map((deal) => ({
            ...deal,
            postCloseFeedback: this.postCloseFeedback(deal, deal.discoverySessions[0] ?? null, postCloseContexts.get(deal.client?.id ?? '') ||
                this.emptyPostCloseOperations()),
        }));
        const postCloseFeedbackDeals = [...allPostCloseFeedbackDeals]
            .sort((a, b) => a.postCloseFeedback.score - b.postCloseFeedback.score)
            .slice(0, 6);
        const salesCoachSummary = this.salesCoachSummary({
            leads,
            assessedLeads,
            dealsWithMomentum,
            assessedDeals,
            missingDiscoveryLeads,
            missingDiscoveryDeals,
            objectionPatterns: allObjectionPatterns,
            forecastRiskDeals,
            postCloseFeedbackDeals: allPostCloseFeedbackDeals,
        });
        return {
            generatedAt: new Date().toISOString(),
            salesCoachSummary,
            metrics: {
                totalLeads: leads.length,
                totalDeals: deals.length,
                assessedLeads: assessedLeads.length,
                assessedDeals: assessedDeals.length,
                highPriorityLeads: assessedLeads.filter((lead) => lead.assessment?.priorityTier === 'high').length,
                dealsBelowReadiness: assessedDeals.filter((deal) => (deal.assessment?.closeReadinessScore ?? 100) < 50).length,
                stalledDeals: dealsWithMomentum.filter((deal) => ['urgent', 'stalled'].includes(deal.momentum.status)).length,
                overdueDealActivities: dealsWithMomentum.reduce((sum, deal) => sum + deal.momentum.overdueActivityCount, 0),
                trackedObjections,
                objectionPatternCount: allObjectionPatterns.length,
                forecastAtRiskDeals: dealsWithMomentum.filter((deal) => ['at_risk', 'watch'].includes(deal.forecast.status)).length,
                postCloseReviewedDeals: allPostCloseFeedbackDeals.length,
                postCloseRiskDeals: allPostCloseFeedbackDeals.filter((deal) => ['risk', 'oversold'].includes(deal.postCloseFeedback.status)).length,
                postCloseLearningDeals: allPostCloseFeedbackDeals.filter((deal) => deal.postCloseFeedback.status === 'learning').length,
                averageForecastConfidence: this.average(dealsWithMomentum.map((deal) => deal.forecast.status === 'unscored' ? null : deal.forecast.confidence)),
                leadsMissingDiscovery: leads.filter((lead) => lead.discoverySessions.length === 0).length,
                dealsMissingDiscovery: deals.filter((deal) => deal.discoverySessions.length === 0).length,
                averageLeadScore: this.average(assessedLeads.map((lead) => lead.assessment?.leadScore ?? null)),
                averageCloseReadiness: this.average(assessedDeals.map((deal) => deal.assessment?.closeReadinessScore ?? null)),
            },
            topLeads,
            atRiskDeals,
            stalledDeals,
            forecastRiskDeals,
            postCloseFeedbackDeals,
            objectionPatterns,
            missingDiscoveryLeads,
            missingDiscoveryDeals,
            recentAssessments,
        };
    }
    async getLeadWorkspace(tenantId, leadId) {
        const lead = await this.getLeadOrThrow(tenantId, leadId);
        const [discovery, assessment] = await Promise.all([
            this.latestDiscovery(tenantId, { leadId }),
            this.latestAssessment(tenantId, { leadId }),
        ]);
        const objectionPatterns = await this.entityObjectionPatterns(tenantId, discovery, assessment);
        const assessmentDraft = assessment
            ? this.assessmentDraftFromRecord(assessment)
            : null;
        const marketSignalProfile = this.marketSignalProfile({
            entityType: 'lead',
            lead,
            discovery,
            assessment: assessmentDraft,
        });
        const valueJustification = this.valueJustification({
            entityType: 'lead',
            discovery,
            assessment: assessmentDraft,
            marketSignalProfile,
        });
        return {
            lead,
            discovery,
            assessment,
            objectionPatterns,
            marketSignalProfile,
            valueJustification,
        };
    }
    async getDealWorkspace(tenantId, dealId) {
        const deal = await this.getDealOrThrow(tenantId, dealId);
        const [discovery, assessment, assessmentHistory] = await Promise.all([
            this.latestDiscovery(tenantId, { dealId }),
            this.latestAssessment(tenantId, { dealId }),
            this.assessmentHistory(tenantId, { dealId }),
        ]);
        const objectionPatterns = await this.entityObjectionPatterns(tenantId, discovery, assessment);
        const assessmentDraft = assessment
            ? this.assessmentDraftFromRecord(assessment)
            : null;
        const momentum = this.dealMomentum({
            ...deal,
            discoverySessions: discovery
                ? [{ id: discovery.id, createdAt: discovery.createdAt }]
                : [],
        }, assessment);
        const forecast = this.dealForecast(deal, assessmentHistory, momentum);
        const postCloseFeedback = deal.client && this.isClosedWonStage(deal.stage)
            ? this.postCloseFeedback(deal, discovery, await this.postCloseOperationsForClient(tenantId, deal.client.id))
            : null;
        const pricingGuardrails = this.pricingGuardrails(discovery, assessment, postCloseFeedback);
        const marketSignalProfile = this.marketSignalProfile({
            entityType: 'deal',
            lead: deal.lead,
            deal,
            discovery,
            assessment: assessmentDraft,
        });
        const valueJustification = this.valueJustification({
            entityType: 'deal',
            discovery,
            assessment: assessmentDraft,
            pricingGuardrails,
            marketSignalProfile,
            forecast,
            postCloseFeedback,
        });
        const followUpSequence = this.followUpSequence({
            deal,
            discovery,
            assessment: assessmentDraft,
            momentum,
            forecast,
            pricingGuardrails,
            marketSignalProfile,
            valueJustification,
        });
        return {
            deal,
            discovery,
            assessment,
            objectionPatterns,
            momentum,
            forecast,
            postCloseFeedback,
            pricingGuardrails,
            marketSignalProfile,
            valueJustification,
            followUpSequence,
        };
    }
    async saveLeadDiscovery(tenantId, leadId, dto, userId) {
        await this.getLeadOrThrow(tenantId, leadId);
        const discovery = await this.prisma.discoverySession.create({
            data: {
                ...this.discoveryData(dto),
                tenantId,
                leadId,
                createdBy: userId,
            },
        });
        await this.auditService.log({
            tenantId,
            userId,
            action: 'CREATE_DISCOVERY',
            entityType: 'Lead',
            entityId: leadId,
            details: 'Captured AI sales accelerator discovery details',
        });
        return discovery;
    }
    async saveDealDiscovery(tenantId, dealId, dto, userId) {
        const deal = await this.getDealOrThrow(tenantId, dealId);
        const discovery = await this.prisma.discoverySession.create({
            data: {
                ...this.discoveryData(dto),
                tenantId,
                leadId: deal.leadId,
                dealId,
                createdBy: userId,
            },
        });
        await this.auditService.log({
            tenantId,
            userId,
            action: 'CREATE_DISCOVERY',
            entityType: 'Deal',
            entityId: dealId,
            details: 'Captured AI sales accelerator discovery details',
        });
        return discovery;
    }
    async generateLeadDiscoveryGuide(tenantId, leadId, userId) {
        const lead = await this.getLeadOrThrow(tenantId, leadId);
        const discovery = await this.latestDiscovery(tenantId, { leadId });
        return this.generateDiscoveryGuide(tenantId, userId, this.contextText({ entityType: 'lead', lead, discovery }), { entityType: 'lead', leadId, discoverySessionId: discovery?.id ?? null });
    }
    async generateDealDiscoveryGuide(tenantId, dealId, userId) {
        const deal = await this.getDealOrThrow(tenantId, dealId);
        const discovery = await this.latestDiscovery(tenantId, { dealId });
        return this.generateDiscoveryGuide(tenantId, userId, this.contextText({
            entityType: 'deal',
            lead: deal.lead,
            deal,
            discovery,
        }), { entityType: 'deal', dealId, discoverySessionId: discovery?.id ?? null });
    }
    async generateLeadOutreach(tenantId, leadId, userId) {
        const lead = await this.getLeadOrThrow(tenantId, leadId);
        const [discovery, assessment] = await Promise.all([
            this.latestDiscovery(tenantId, { leadId }),
            this.latestAssessment(tenantId, { leadId }),
        ]);
        return this.generateOutreachPlan(tenantId, userId, this.contextText({
            entityType: 'lead',
            lead,
            discovery,
            assessment: assessment ? this.assessmentDraftFromRecord(assessment) : null,
        }), { entityType: 'lead', leadId, discoverySessionId: discovery?.id ?? null });
    }
    async generateDealOutreach(tenantId, dealId, userId) {
        const deal = await this.getDealOrThrow(tenantId, dealId);
        const [discovery, assessment] = await Promise.all([
            this.latestDiscovery(tenantId, { dealId }),
            this.latestAssessment(tenantId, { dealId }),
        ]);
        return this.generateOutreachPlan(tenantId, userId, this.contextText({
            entityType: 'deal',
            lead: deal.lead,
            deal,
            discovery,
            assessment: assessment ? this.assessmentDraftFromRecord(assessment) : null,
        }), { entityType: 'deal', dealId, discoverySessionId: discovery?.id ?? null });
    }
    async analyzeLeadDiscoveryCall(tenantId, leadId, dto, userId) {
        const lead = await this.getLeadOrThrow(tenantId, leadId);
        const [discovery, assessment] = await Promise.all([
            this.latestDiscovery(tenantId, { leadId }),
            this.latestAssessment(tenantId, { leadId }),
        ]);
        return this.analyzeDiscoveryCall(tenantId, userId, this.contextText({
            entityType: 'lead',
            lead,
            discovery,
            assessment: assessment ? this.assessmentDraftFromRecord(assessment) : null,
        }), dto.transcript, {
            entityType: 'lead',
            leadId,
            discoverySessionId: discovery?.id ?? null,
        });
    }
    async analyzeDealDiscoveryCall(tenantId, dealId, dto, userId) {
        const deal = await this.getDealOrThrow(tenantId, dealId);
        const [discovery, assessment] = await Promise.all([
            this.latestDiscovery(tenantId, { dealId }),
            this.latestAssessment(tenantId, { dealId }),
        ]);
        return this.analyzeDiscoveryCall(tenantId, userId, this.contextText({
            entityType: 'deal',
            lead: deal.lead,
            deal,
            discovery,
            assessment: assessment ? this.assessmentDraftFromRecord(assessment) : null,
        }), dto.transcript, {
            entityType: 'deal',
            dealId,
            discoverySessionId: discovery?.id ?? null,
        });
    }
    async coachLeadDiscoveryCall(tenantId, leadId, dto, userId) {
        const lead = await this.getLeadOrThrow(tenantId, leadId);
        const [discovery, assessment] = await Promise.all([
            this.latestDiscovery(tenantId, { leadId }),
            this.latestAssessment(tenantId, { leadId }),
        ]);
        return this.coachDiscoveryCall(tenantId, userId, this.contextText({
            entityType: 'lead',
            lead,
            discovery,
            assessment: assessment ? this.assessmentDraftFromRecord(assessment) : null,
        }), dto.transcript || '', {
            entityType: 'lead',
            leadId,
            discoverySessionId: discovery?.id ?? null,
        });
    }
    async coachDealDiscoveryCall(tenantId, dealId, dto, userId) {
        const deal = await this.getDealOrThrow(tenantId, dealId);
        const [discovery, assessment] = await Promise.all([
            this.latestDiscovery(tenantId, { dealId }),
            this.latestAssessment(tenantId, { dealId }),
        ]);
        return this.coachDiscoveryCall(tenantId, userId, this.contextText({
            entityType: 'deal',
            lead: deal.lead,
            deal,
            discovery,
            assessment: assessment ? this.assessmentDraftFromRecord(assessment) : null,
        }), dto.transcript || '', {
            entityType: 'deal',
            dealId,
            discoverySessionId: discovery?.id ?? null,
        });
    }
    async scoreLead(tenantId, leadId, userId) {
        const lead = await this.getLeadOrThrow(tenantId, leadId);
        const discovery = await this.latestDiscovery(tenantId, { leadId });
        return this.createAssessment(tenantId, userId, {
            entityType: 'lead',
            lead,
            discovery,
        }, {
            leadId,
            dealId: null,
            discoverySessionId: discovery?.id ?? null,
        });
    }
    async scoreDeal(tenantId, dealId, userId) {
        const deal = await this.getDealOrThrow(tenantId, dealId);
        const discovery = await this.latestDiscovery(tenantId, { dealId });
        return this.createAssessment(tenantId, userId, {
            entityType: 'deal',
            lead: deal.lead,
            deal,
            discovery,
        }, {
            leadId: deal.leadId,
            dealId,
            discoverySessionId: discovery?.id ?? null,
        });
    }
    async generateProposalFromDiscovery(tenantId, dealId, dto, userId) {
        const deal = await this.getDealOrThrow(tenantId, dealId);
        const discovery = await this.latestDiscovery(tenantId, { dealId });
        const assessment = await this.latestAssessment(tenantId, { dealId });
        const postCloseFeedback = deal.client && this.isClosedWonStage(deal.stage)
            ? this.postCloseFeedback(deal, discovery, await this.postCloseOperationsForClient(tenantId, deal.client.id))
            : null;
        if (!discovery) {
            throw new common_1.BadRequestException('Capture discovery details before generating a discovery-based proposal.');
        }
        const pricingGuardrails = this.pricingGuardrails(discovery, assessment, postCloseFeedback);
        const assessmentDraft = assessment
            ? this.assessmentDraftFromRecord(assessment)
            : null;
        const marketSignalProfile = this.marketSignalProfile({
            entityType: 'deal',
            lead: deal.lead,
            deal,
            discovery,
            assessment: assessmentDraft,
        });
        const valueJustification = this.valueJustification({
            entityType: 'deal',
            discovery,
            assessment: assessmentDraft,
            pricingGuardrails,
            marketSignalProfile,
            postCloseFeedback,
        });
        const followUpSequence = this.followUpSequence({
            deal,
            discovery,
            assessment: assessmentDraft,
            pricingGuardrails,
            marketSignalProfile,
            valueJustification,
        });
        const context = [
            this.contextText({
                entityType: 'deal',
                lead: deal.lead,
                deal,
                discovery,
                assessment: assessmentDraft,
            }),
            this.valueJustificationContext(valueJustification),
        ].join('\n\n');
        let content;
        let fallbackUsed = false;
        let errorMessage;
        try {
            content = await this.aiService.generateDiscoveryProposal(context);
        }
        catch (error) {
            fallbackUsed = true;
            errorMessage = error instanceof Error ? error.message : String(error);
            this.logger.warn(`Discovery proposal fell back: ${errorMessage}`);
            content = this.ruleProposal(deal.lead.company, discovery, assessment);
        }
        const generation = await this.aiMonitoringService.logGeneration({
            tenantId,
            createdBy: userId,
            sourceModule: 'sales_accelerator',
            promptKey: 'discovery_proposal',
            modelUsed: fallbackUsed ? 'rule-or-fallback' : this.aiService.getModelName(),
            inputSource: {
                entityType: 'deal',
                dealId,
                discoverySessionId: discovery.id,
            },
            generatedOutput: { content, pricingGuardrails, valueJustification },
            fallbackUsed,
            status: fallbackUsed ? 'fallback' : 'success',
            errorMessage,
            clientVisible: true,
        });
        const proposal = await this.proposalsService.create(tenantId, {
            title: dto.title?.trim() ||
                `Security Services Proposal - ${deal.lead.company}`,
            content,
            status: 'draft',
            leadId: deal.leadId,
            dealId,
            clientId: dto.clientId?.trim() || deal.clientId || undefined,
        }, userId);
        return {
            proposal,
            pricingGuardrails,
            valueJustification,
            followUpSequence,
            aiGenerationId: generation?.id ?? null,
            fallbackUsed,
        };
    }
    async createDealFollowUp(tenantId, dealId, dto, userId) {
        const deal = await this.getDealOrThrow(tenantId, dealId);
        const assessment = await this.latestAssessment(tenantId, { dealId });
        const dueDate = dto.dueDate ? new Date(dto.dueDate) : this.tomorrow();
        const subject = dto.subject?.trim() ||
            assessment?.recommendedNextAction ||
            `Follow up on ${deal.name}`;
        const activity = await this.activitiesService.create({
            type: 'task',
            subject,
            description: dto.description?.trim() ||
                [
                    assessment?.summary,
                    assessment?.riskProfile ? `Risk profile: ${assessment.riskProfile}` : null,
                    assessment?.proposalAngle ? `Proposal angle: ${assessment.proposalAngle}` : null,
                ]
                    .filter(Boolean)
                    .join('\n'),
            dueDate,
            dealId,
            tenantId,
            userId,
        });
        await this.auditService.log({
            tenantId,
            userId,
            action: 'CREATE_FOLLOW_UP',
            entityType: 'Deal',
            entityId: dealId,
            details: `Created Sales Accelerator follow-up task: ${activity.subject}`,
        });
        return activity;
    }
    async createDealFollowUpSequence(tenantId, dealId, userId) {
        const deal = await this.getDealOrThrow(tenantId, dealId);
        const [discovery, assessment, assessmentHistory] = await Promise.all([
            this.latestDiscovery(tenantId, { dealId }),
            this.latestAssessment(tenantId, { dealId }),
            this.assessmentHistory(tenantId, { dealId }),
        ]);
        const assessmentDraft = assessment
            ? this.assessmentDraftFromRecord(assessment)
            : null;
        const momentum = this.dealMomentum({
            ...deal,
            discoverySessions: discovery
                ? [{ id: discovery.id, createdAt: discovery.createdAt }]
                : [],
        }, assessment);
        const forecast = this.dealForecast(deal, assessmentHistory, momentum);
        const postCloseFeedback = deal.client && this.isClosedWonStage(deal.stage)
            ? this.postCloseFeedback(deal, discovery, await this.postCloseOperationsForClient(tenantId, deal.client.id))
            : null;
        const pricingGuardrails = this.pricingGuardrails(discovery, assessment, postCloseFeedback);
        const marketSignalProfile = this.marketSignalProfile({
            entityType: 'deal',
            lead: deal.lead,
            deal,
            discovery,
            assessment: assessmentDraft,
        });
        const valueJustification = this.valueJustification({
            entityType: 'deal',
            discovery,
            assessment: assessmentDraft,
            pricingGuardrails,
            marketSignalProfile,
            forecast,
            postCloseFeedback,
        });
        const sequence = this.followUpSequence({
            deal,
            discovery,
            assessment: assessmentDraft,
            momentum,
            forecast,
            pricingGuardrails,
            marketSignalProfile,
            valueJustification,
        });
        const existingSubjects = new Set((deal.activities || [])
            .filter((activity) => activity.status !== 'completed')
            .map((activity) => activity.subject.toLowerCase()));
        const createdActivities = [];
        let skippedDuplicateCount = 0;
        for (const step of sequence.steps) {
            const subject = `[Sales Sequence] ${step.subject}`;
            if (existingSubjects.has(subject.toLowerCase())) {
                skippedDuplicateCount += 1;
                continue;
            }
            const activity = await this.activitiesService.create({
                type: step.channel === 'email' ? 'task' : step.channel,
                subject,
                description: [
                    `Objective: ${step.objective}`,
                    step.description,
                    sequence.objectionsToAddress.length
                        ? `Objections to address: ${sequence.objectionsToAddress.join('; ')}`
                        : null,
                    sequence.stopConditions.length
                        ? `Stop conditions: ${sequence.stopConditions.join('; ')}`
                        : null,
                ]
                    .filter(Boolean)
                    .join('\n\n'),
                dueDate: step.dueDate,
                dealId,
                tenantId,
                userId,
            });
            existingSubjects.add(subject.toLowerCase());
            createdActivities.push(activity);
        }
        await this.auditService.log({
            tenantId,
            userId,
            action: 'CREATE_FOLLOW_UP_SEQUENCE',
            entityType: 'Deal',
            entityId: dealId,
            details: `Created ${createdActivities.length} Sales Accelerator sequence activities`,
        });
        return {
            sequence,
            createdActivities,
            skippedDuplicateCount,
        };
    }
    async generateDiscoveryGuide(tenantId, userId, context, inputSource) {
        let guide;
        let fallbackUsed = false;
        let errorMessage;
        try {
            guide = await this.aiService.generateDiscoveryGuide(context);
        }
        catch (error) {
            fallbackUsed = true;
            errorMessage = error instanceof Error ? error.message : String(error);
            this.logger.warn(`Discovery guide fell back: ${errorMessage}`);
            guide = this.ruleDiscoveryGuide();
        }
        const generation = await this.aiMonitoringService.logGeneration({
            tenantId,
            createdBy: userId,
            sourceModule: 'sales_accelerator',
            promptKey: 'discovery_guide',
            modelUsed: fallbackUsed ? 'rule-or-fallback' : this.aiService.getModelName(),
            inputSource,
            generatedOutput: guide,
            fallbackUsed,
            status: fallbackUsed ? 'fallback' : 'success',
            errorMessage,
            clientVisible: false,
        });
        return {
            guide,
            aiGenerationId: generation?.id ?? null,
            fallbackUsed,
        };
    }
    async generateOutreachPlan(tenantId, userId, context, inputSource) {
        let outreach;
        let fallbackUsed = false;
        let errorMessage;
        try {
            outreach = await this.aiService.generateOutreachPlan(context);
        }
        catch (error) {
            fallbackUsed = true;
            errorMessage = error instanceof Error ? error.message : String(error);
            this.logger.warn(`Outreach plan fell back: ${errorMessage}`);
            outreach = this.ruleOutreachPlan();
        }
        const generation = await this.aiMonitoringService.logGeneration({
            tenantId,
            createdBy: userId,
            sourceModule: 'sales_accelerator',
            promptKey: 'outreach_plan',
            modelUsed: fallbackUsed ? 'rule-or-fallback' : this.aiService.getModelName(),
            inputSource,
            generatedOutput: outreach,
            fallbackUsed,
            status: fallbackUsed ? 'fallback' : 'success',
            errorMessage,
            clientVisible: false,
        });
        return {
            outreach,
            aiGenerationId: generation?.id ?? null,
            fallbackUsed,
        };
    }
    async analyzeDiscoveryCall(tenantId, userId, context, transcript, inputSource) {
        const transcriptText = transcript.trim();
        if (transcriptText.length < 20) {
            throw new common_1.BadRequestException('Add at least 20 characters of call notes before analyzing.');
        }
        let intelligence;
        let fallbackUsed = false;
        let errorMessage;
        try {
            intelligence = await this.aiService.generateDiscoveryCallIntelligence(context, transcriptText);
        }
        catch (error) {
            fallbackUsed = true;
            errorMessage = error instanceof Error ? error.message : String(error);
            this.logger.warn(`Discovery call intelligence fell back: ${errorMessage}`);
            intelligence = this.ruleDiscoveryCallIntelligence(transcriptText);
        }
        const generation = await this.aiMonitoringService.logGeneration({
            tenantId,
            createdBy: userId,
            sourceModule: 'sales_accelerator',
            promptKey: 'discovery_call_intelligence',
            modelUsed: fallbackUsed ? 'rule-or-fallback' : this.aiService.getModelName(),
            inputSource: {
                ...inputSource,
                transcriptLength: transcriptText.length,
            },
            generatedOutput: intelligence,
            fallbackUsed,
            status: fallbackUsed ? 'fallback' : 'success',
            errorMessage,
            clientVisible: false,
        });
        return {
            intelligence,
            aiGenerationId: generation?.id ?? null,
            fallbackUsed,
        };
    }
    async coachDiscoveryCall(tenantId, userId, context, transcript, inputSource) {
        const transcriptText = transcript.trim();
        let coach;
        let fallbackUsed = false;
        let errorMessage;
        try {
            coach = await this.aiService.generateDiscoveryLiveCoach(context, transcriptText);
        }
        catch (error) {
            fallbackUsed = true;
            errorMessage = error instanceof Error ? error.message : String(error);
            this.logger.warn(`Discovery live coach fell back: ${errorMessage}`);
            coach = this.ruleDiscoveryLiveCoach(transcriptText);
        }
        const generation = await this.aiMonitoringService.logGeneration({
            tenantId,
            createdBy: userId,
            sourceModule: 'sales_accelerator',
            promptKey: 'discovery_live_coach',
            modelUsed: fallbackUsed ? 'rule-or-fallback' : this.aiService.getModelName(),
            inputSource: {
                ...inputSource,
                transcriptLength: transcriptText.length,
            },
            generatedOutput: coach,
            fallbackUsed,
            status: fallbackUsed ? 'fallback' : 'success',
            errorMessage,
            clientVisible: false,
        });
        return {
            coach,
            aiGenerationId: generation?.id ?? null,
            fallbackUsed,
        };
    }
    async createAssessment(tenantId, userId, context, ids) {
        const contextText = this.contextText(context);
        const heuristic = this.ruleAssessment(context);
        let draft = heuristic;
        let fallbackUsed = false;
        let errorMessage;
        try {
            draft = await this.aiService.generateSalesAssessment(contextText);
        }
        catch (error) {
            fallbackUsed = true;
            errorMessage = error instanceof Error ? error.message : String(error);
            this.logger.warn(`Sales assessment fell back: ${errorMessage}`);
        }
        draft = this.mergeAssessmentDefaults(draft, heuristic);
        const generation = await this.aiMonitoringService.logGeneration({
            tenantId,
            createdBy: userId,
            sourceModule: 'sales_accelerator',
            promptKey: 'sales_assessment',
            modelUsed: fallbackUsed ? 'rule-or-fallback' : this.aiService.getModelName(),
            inputSource: {
                entityType: context.entityType,
                leadId: ids.leadId,
                dealId: ids.dealId,
                discoverySessionId: ids.discoverySessionId,
            },
            generatedOutput: draft,
            fallbackUsed,
            status: fallbackUsed ? 'fallback' : 'success',
            errorMessage,
            clientVisible: false,
        });
        const assessment = await this.prisma.salesAssessment.create({
            data: {
                tenantId,
                leadId: ids.leadId || undefined,
                dealId: ids.dealId || undefined,
                discoverySessionId: ids.discoverySessionId || undefined,
                assessmentType: context.entityType === 'deal' ? 'deal_assessment' : 'lead_assessment',
                leadScore: draft.leadScore,
                priorityTier: draft.priorityTier,
                closeReadinessScore: draft.closeReadinessScore,
                discoveryQualityScore: draft.discoveryQualityScore,
                riskProfile: draft.riskProfile,
                proposalAngle: draft.proposalAngle,
                recommendedNextAction: draft.recommendedNextAction,
                missingQuestions: draft.missingQuestions,
                objectionRisks: draft.objectionRisks,
                summary: draft.summary,
                generatedOutput: draft,
                aiGenerationId: generation?.id ?? undefined,
                createdBy: userId,
            },
        });
        return {
            assessment,
            aiGenerationId: generation?.id ?? null,
            fallbackUsed,
        };
    }
    async getLeadOrThrow(tenantId, leadId) {
        const lead = await this.prisma.lead.findFirst({
            where: { id: leadId, tenantId },
            include: {
                notes: { orderBy: { createdAt: 'desc' }, take: 8 },
                proposals: {
                    orderBy: { createdAt: 'desc' },
                    take: 5,
                    select: { title: true, status: true, createdAt: true },
                },
            },
        });
        if (!lead)
            throw new common_1.NotFoundException('Lead not found');
        return lead;
    }
    async getDealOrThrow(tenantId, dealId) {
        const deal = await this.prisma.deal.findFirst({
            where: { id: dealId, tenantId },
            include: {
                lead: {
                    include: {
                        notes: { orderBy: { createdAt: 'desc' }, take: 8 },
                        proposals: {
                            orderBy: { createdAt: 'desc' },
                            take: 5,
                            select: { title: true, status: true, createdAt: true },
                        },
                    },
                },
                notes: { orderBy: { createdAt: 'desc' }, take: 8 },
                activities: {
                    orderBy: { createdAt: 'desc' },
                    take: 20,
                    select: {
                        id: true,
                        type: true,
                        subject: true,
                        status: true,
                        dueDate: true,
                        createdAt: true,
                    },
                },
                proposals: {
                    orderBy: { createdAt: 'desc' },
                    take: 5,
                    select: { title: true, status: true, createdAt: true },
                },
                client: {
                    select: { id: true, name: true, companyName: true },
                },
            },
        });
        if (!deal)
            throw new common_1.NotFoundException('Deal not found');
        return deal;
    }
    salesCoachSummary(context) {
        const focusAreas = [];
        const coachingActions = [];
        const pipelineRisks = [];
        const positiveSignals = [];
        const totalRecords = context.leads.length + context.dealsWithMomentum.length;
        const missingDiscoveryCount = context.missingDiscoveryLeads.length + context.missingDiscoveryDeals.length;
        const missingDiscoveryRate = totalRecords === 0 ? 0 : Math.round((missingDiscoveryCount / totalRecords) * 100);
        const averageLeadScore = this.average(context.assessedLeads.map((lead) => lead.assessment?.leadScore ?? null));
        const averageCloseReadiness = this.average(context.assessedDeals.map((deal) => deal.assessment?.closeReadinessScore ?? null));
        const averageDiscoveryQuality = this.average([
            ...context.assessedLeads.map((lead) => lead.assessment?.discoveryQualityScore ?? null),
            ...context.assessedDeals.map((deal) => deal.assessment?.discoveryQualityScore ?? null),
        ]);
        const stalledDeals = context.dealsWithMomentum.filter((deal) => ['urgent', 'stalled'].includes(deal.momentum.status));
        const overdueTasks = context.dealsWithMomentum.reduce((sum, deal) => sum + deal.momentum.overdueActivityCount, 0);
        const highLossObjections = context.objectionPatterns.filter((pattern) => pattern.lossRate !== null &&
            pattern.lossRate >= 50 &&
            pattern.lostDealCount > 0);
        const postCloseRiskDeals = context.postCloseFeedbackDeals.filter((deal) => ['risk', 'oversold'].includes(deal.postCloseFeedback.status));
        let score = 100;
        if (missingDiscoveryRate >= 35) {
            score -= 18;
            focusAreas.push('Discovery coverage is the main coaching gap.');
            coachingActions.push('Coach reps to capture risk driver, guard count, hours, buyer role, timeline, and budget before proposal.');
            pipelineRisks.push(`${missingDiscoveryCount} records are missing discovery, which weakens scoring and proposal quality.`);
        }
        else if (missingDiscoveryCount > 0) {
            score -= 8;
            coachingActions.push('Clear the remaining missing discovery queue before adding more proposal work.');
        }
        else {
            positiveSignals.push('Discovery coverage is complete across the active dashboard lists.');
        }
        if ((averageDiscoveryQuality ?? 100) < 60) {
            score -= 14;
            focusAreas.push('Discovery quality needs tighter qualification.');
            coachingActions.push('Review recent calls for missing authority, budget, risk, scope, and timing questions.');
        }
        else if (averageDiscoveryQuality !== null) {
            positiveSignals.push(`Average discovery quality is ${averageDiscoveryQuality}.`);
        }
        if ((averageCloseReadiness ?? 100) < 55) {
            score -= 16;
            focusAreas.push('Close readiness is low.');
            coachingActions.push('Use readiness scoring to decide which deals need more discovery before proposal follow-up.');
            pipelineRisks.push('Low readiness may cause proposal churn or price-only comparisons.');
        }
        else if (averageCloseReadiness !== null) {
            positiveSignals.push(`Average close readiness is ${averageCloseReadiness}.`);
        }
        if (stalledDeals.length > 0) {
            score -= Math.min(18, stalledDeals.length * 5);
            focusAreas.push('Deal momentum needs inspection.');
            coachingActions.push('Run rescue sequences for stalled deals and check whether each has a dated next step.');
            pipelineRisks.push(`${stalledDeals.length} deals are stalled or urgent.`);
        }
        if (overdueTasks > 0) {
            score -= Math.min(14, overdueTasks * 2);
            coachingActions.push('Clear overdue follow-up tasks before creating new sequences.');
            pipelineRisks.push(`${overdueTasks} follow-up activities are overdue.`);
        }
        if (context.forecastRiskDeals.length > 0) {
            score -= Math.min(14, context.forecastRiskDeals.length * 4);
            focusAreas.push('Forecast risk needs manager review.');
            coachingActions.push('Review at-risk forecast deals for missing decision criteria, timeline, and objections.');
            pipelineRisks.push(`${context.forecastRiskDeals.length} deals are flagged by forecast risk.`);
        }
        if (highLossObjections.length > 0) {
            score -= Math.min(16, highLossObjections.length * 5);
            focusAreas.push('Objection handling is affecting outcomes.');
            coachingActions.push(`Practice responses for ${highLossObjections[0].label.toLowerCase()} objections using the objection playbook.`);
            pipelineRisks.push(`${highLossObjections.length} objection patterns have a high loss signal.`);
        }
        else if (context.objectionPatterns.length > 0) {
            positiveSignals.push('Objection patterns are being captured for coaching.');
        }
        if (postCloseRiskDeals.length > 0) {
            score -= Math.min(12, postCloseRiskDeals.length * 4);
            focusAreas.push('Post-close feedback should update sales promises.');
            coachingActions.push('Review oversold/risk accounts and convert the lessons into proposal guardrails.');
            pipelineRisks.push(`${postCloseRiskDeals.length} closed-won deals show post-close risk.`);
        }
        else if (context.postCloseFeedbackDeals.length > 0) {
            positiveSignals.push('Post-close feedback loop has usable sales learning data.');
        }
        if ((averageLeadScore ?? 0) >= 70) {
            positiveSignals.push(`Average lead score is ${averageLeadScore}.`);
        }
        if (focusAreas.length === 0) {
            focusAreas.push('Pipeline execution is healthy; keep reinforcing value-based discovery and timely follow-up.');
        }
        if (coachingActions.length === 0) {
            coachingActions.push('Use one weekly review to inspect discovery quality, value justification, and next-step hygiene.');
        }
        if (pipelineRisks.length === 0) {
            pipelineRisks.push('No major dashboard-level pipeline risk detected.');
        }
        if (positiveSignals.length === 0) {
            positiveSignals.push('Sales intelligence is active; continue capturing data to strengthen coaching signals.');
        }
        const coachScore = this.clamp(score);
        const status = coachScore >= 75 ? 'strong' : coachScore >= 55 ? 'watch' : 'at_risk';
        return {
            score: coachScore,
            status,
            headline: this.salesCoachHeadline(status),
            focusAreas: Array.from(new Set(focusAreas)).slice(0, 5),
            coachingActions: Array.from(new Set(coachingActions)).slice(0, 6),
            pipelineRisks: Array.from(new Set(pipelineRisks)).slice(0, 5),
            positiveSignals: Array.from(new Set(positiveSignals)).slice(0, 5),
        };
    }
    salesCoachHeadline(status) {
        if (status === 'strong') {
            return 'Sales execution is healthy. Keep coaching consistency and proposal discipline.';
        }
        if (status === 'watch') {
            return 'Sales execution needs focused coaching before risk turns into lost deals.';
        }
        return 'Sales execution is at risk. Prioritize discovery, follow-up, and objection coaching now.';
    }
    latestDiscovery(tenantId, where) {
        return this.prisma.discoverySession.findFirst({
            where: {
                tenantId,
                ...(where.dealId ? { dealId: where.dealId } : { leadId: where.leadId }),
            },
            orderBy: { createdAt: 'desc' },
        });
    }
    latestAssessment(tenantId, where) {
        return this.prisma.salesAssessment.findFirst({
            where: {
                tenantId,
                ...(where.dealId ? { dealId: where.dealId } : { leadId: where.leadId }),
            },
            orderBy: { createdAt: 'desc' },
        });
    }
    assessmentHistory(tenantId, where) {
        return this.prisma.salesAssessment.findMany({
            where: {
                tenantId,
                ...(where.dealId ? { dealId: where.dealId } : { leadId: where.leadId }),
            },
            orderBy: { createdAt: 'desc' },
            take: 8,
            select: {
                id: true,
                leadScore: true,
                priorityTier: true,
                closeReadinessScore: true,
                discoveryQualityScore: true,
                recommendedNextAction: true,
                summary: true,
                createdAt: true,
            },
        });
    }
    discoveryData(dto) {
        return {
            propertyType: this.cleanString(dto.propertyType),
            buyerRole: this.cleanString(dto.buyerRole),
            currentProvider: this.cleanString(dto.currentProvider),
            guardCount: dto.guardCount,
            serviceHours: this.cleanString(dto.serviceHours),
            painPoints: this.cleanList(dto.painPoints),
            riskConcerns: this.cleanList(dto.riskConcerns),
            decisionTimeline: this.cleanString(dto.decisionTimeline),
            budgetSensitivity: this.cleanString(dto.budgetSensitivity),
            objections: this.cleanList(dto.objections),
            notes: this.cleanString(dto.notes),
        };
    }
    contextText(context) {
        const discovery = context.discovery;
        const deal = context.deal;
        const leadNotes = context.lead.notes?.map((note) => note.content).join(' | ') || 'None';
        const dealNotes = deal?.notes?.map((note) => note.content).join(' | ') || 'None';
        const proposals = [
            ...(context.lead.proposals || []),
            ...(deal?.proposals || []),
        ]
            .map((proposal) => `${proposal.title} (${proposal.status})`)
            .join(' | ') || 'None';
        return [
            `Entity type: ${context.entityType}`,
            `Lead: ${context.lead.name} at ${context.lead.company}`,
            `Lead status: ${context.lead.status}`,
            `Deal: ${deal ? `${deal.name} (${deal.stage})` : 'No deal yet'}`,
            `Client: ${deal?.client ? deal.client.companyName || deal.client.name : 'No client linked'}`,
            `Property type: ${discovery?.propertyType || 'Unknown'}`,
            `Buyer role: ${discovery?.buyerRole || 'Unknown'}`,
            `Current provider: ${discovery?.currentProvider || 'Unknown'}`,
            `Guard count: ${discovery?.guardCount ?? 'Unknown'}`,
            `Service hours: ${discovery?.serviceHours || 'Unknown'}`,
            `Pain points: ${this.displayList(discovery?.painPoints)}`,
            `Risk concerns: ${this.displayList(discovery?.riskConcerns)}`,
            `Decision timeline: ${discovery?.decisionTimeline || 'Unknown'}`,
            `Budget sensitivity: ${discovery?.budgetSensitivity || 'Unknown'}`,
            `Objections: ${this.displayList(discovery?.objections)}`,
            `Discovery notes: ${discovery?.notes || 'None'}`,
            `Lead notes: ${leadNotes}`,
            `Deal notes: ${dealNotes}`,
            `Existing proposals: ${proposals}`,
            context.assessment
                ? `Latest assessment: ${context.assessment.summary}. Next action: ${context.assessment.recommendedNextAction}`
                : 'Latest assessment: None',
        ].join('\n');
    }
    async entityObjectionPatterns(tenantId, discovery, assessment) {
        const sourceTexts = [
            ...(discovery?.objections || []),
            ...(assessment?.objectionRisks || []),
        ];
        const keys = Array.from(new Set(sourceTexts
            .map((text) => this.objectionDefinition(text).key)
            .filter(Boolean)));
        if (keys.length === 0)
            return [];
        const [discoveryObjections, assessmentObjections] = await Promise.all([
            this.prisma.discoverySession.findMany({
                where: { tenantId },
                orderBy: { createdAt: 'desc' },
                take: 200,
                select: {
                    objections: true,
                    lead: {
                        select: { id: true, name: true, company: true, status: true },
                    },
                    deal: {
                        select: {
                            id: true,
                            name: true,
                            stage: true,
                            lead: { select: { company: true } },
                        },
                    },
                },
            }),
            this.prisma.salesAssessment.findMany({
                where: { tenantId },
                orderBy: { createdAt: 'desc' },
                take: 200,
                select: {
                    objectionRisks: true,
                    lead: {
                        select: { id: true, name: true, company: true, status: true },
                    },
                    deal: {
                        select: {
                            id: true,
                            name: true,
                            stage: true,
                            lead: { select: { company: true } },
                        },
                    },
                },
            }),
        ]);
        return this.buildObjectionPatterns(discoveryObjections, assessmentObjections, {
            keys,
            limit: 4,
        });
    }
    buildObjectionPatterns(discoveryRecords, assessmentRecords, options = {}) {
        const buckets = new Map();
        const outcomeBuckets = new Map();
        const allowedKeys = options.keys ? new Set(options.keys) : null;
        const ensureBucket = (text) => {
            const definition = this.objectionDefinition(text);
            if (allowedKeys && !allowedKeys.has(definition.key))
                return null;
            if (!buckets.has(definition.key)) {
                buckets.set(definition.key, {
                    key: definition.key,
                    label: definition.label,
                    count: 0,
                    severity: 'low',
                    lostDealCount: 0,
                    wonDealCount: 0,
                    openDealCount: 0,
                    lossRate: null,
                    outcomeSignal: 'No closed-deal outcome signal is available for this objection yet.',
                    examples: [],
                    recommendedResponse: definition.recommendedResponse,
                    playbook: definition.playbook,
                    relatedLeads: [],
                    relatedDeals: [],
                });
                outcomeBuckets.set(definition.key, {
                    won: new Set(),
                    lost: new Set(),
                    open: new Set(),
                });
            }
            return buckets.get(definition.key) ?? null;
        };
        const addRelated = (pattern, source) => {
            if (source.lead &&
                pattern.relatedLeads.length < 3 &&
                !pattern.relatedLeads.some((lead) => lead.id === source.lead?.id)) {
                pattern.relatedLeads.push(source.lead);
            }
            if (source.deal &&
                pattern.relatedDeals.length < 3 &&
                !pattern.relatedDeals.some((deal) => deal.id === source.deal?.id)) {
                pattern.relatedDeals.push({
                    id: source.deal.id,
                    name: source.deal.name,
                    stage: source.deal.stage,
                    company: source.deal.lead?.company || source.lead?.company || 'Unknown',
                });
            }
        };
        const addText = (text, source) => {
            const cleaned = text.trim();
            if (!cleaned)
                return;
            const pattern = ensureBucket(cleaned);
            if (!pattern)
                return;
            pattern.count += 1;
            if (source.deal) {
                const outcomes = outcomeBuckets.get(pattern.key);
                const outcome = this.dealOutcome(source.deal.stage);
                outcomes?.[outcome].add(source.deal.id);
            }
            if (pattern.examples.length < 3 &&
                !pattern.examples.some((example) => example.toLowerCase() === cleaned.toLowerCase())) {
                pattern.examples.push(cleaned);
            }
            addRelated(pattern, source);
        };
        discoveryRecords.forEach((record) => {
            record.objections.forEach((objection) => addText(objection, record));
        });
        assessmentRecords.forEach((record) => {
            record.objectionRisks.forEach((objection) => addText(objection, record));
        });
        return Array.from(buckets.values())
            .map((pattern) => {
            const outcomes = outcomeBuckets.get(pattern.key);
            const wonDealCount = outcomes?.won.size ?? 0;
            const lostDealCount = outcomes?.lost.size ?? 0;
            const openDealCount = outcomes?.open.size ?? 0;
            const closedOutcomes = wonDealCount + lostDealCount;
            const lossRate = closedOutcomes > 0
                ? this.clamp((lostDealCount / closedOutcomes) * 100)
                : null;
            return {
                ...pattern,
                wonDealCount,
                lostDealCount,
                openDealCount,
                lossRate,
                outcomeSignal: this.objectionOutcomeSignal(pattern.label, lostDealCount, wonDealCount, openDealCount, lossRate),
                severity: this.objectionSeverity(pattern.key, pattern.count, lossRate),
            };
        })
            .sort((a, b) => b.count - a.count)
            .slice(0, options.limit ?? 6);
    }
    objectionDefinition(text) {
        const normalized = text.toLowerCase();
        const definitions = [
            {
                key: 'price_budget',
                label: 'Price and Budget',
                test: /(price|cost|budget|expensive|cheap|rate|hourly|fee|quote|bid|lowest|afford)/,
                recommendedResponse: 'Reframe the conversation from hourly rate to risk exposure, supervision quality, reporting, and avoided incident cost.',
                playbook: [
                    'Ask what risk or incident would be most costly if coverage fails.',
                    'Compare scope, supervision, reporting, and escalation instead of only rate.',
                    'Offer options that protect the must-have coverage while separating nice-to-have add-ons.',
                ],
            },
            {
                key: 'incumbent_provider',
                label: 'Current Provider',
                test: /(current provider|existing provider|vendor|contract|incumbent|already have|satisfied|using someone)/,
                recommendedResponse: 'Do not attack the incumbent. Identify coverage gaps, reporting friction, and service consistency issues the buyer would still improve.',
                playbook: [
                    'Ask what they would change about the current provider if switching were easy.',
                    'Look for missed posts, poor reporting, turnover, or slow escalation.',
                    'Offer a benchmark review or site walkthrough before asking for a full switch.',
                ],
            },
            {
                key: 'timing_urgency',
                label: 'Timing and Urgency',
                test: /(timing|timeline|later|not now|delay|start date|soon|urgent|wait|quarter|next month|next year)/,
                recommendedResponse: 'Tie the timeline to a concrete event, risk window, contract date, or operational trigger.',
                playbook: [
                    'Ask what happens if the coverage decision slips by 30 days.',
                    'Confirm the real start date and any board, procurement, or event deadlines.',
                    'Set a dated next step even if the final start date is later.',
                ],
            },
            {
                key: 'decision_authority',
                label: 'Decision Authority',
                test: /(decision|approve|approval|owner|board|committee|manager|corporate|procurement|legal|need to ask|sign off)/,
                recommendedResponse: 'Map the buying group and equip the champion with risk-based language for the approver.',
                playbook: [
                    'Ask who signs the agreement and who can block the decision.',
                    'Confirm what each stakeholder cares about: risk, cost, tenant experience, or compliance.',
                    'Send a short decision summary the champion can forward internally.',
                ],
            },
            {
                key: 'service_quality',
                label: 'Service Quality and Trust',
                test: /(quality|reliable|reliability|no show|turnover|training|supervision|trust|accountability|professional|experience|poor service)/,
                recommendedResponse: 'Use proof of supervision, hiring standards, reporting cadence, and escalation controls to reduce trust concerns.',
                playbook: [
                    'Ask what service failure would break trust fastest.',
                    'Explain supervisor checks, post orders, guard training, and incident reporting.',
                    'Offer a 30/60/90-day service review plan with measurable checkpoints.',
                ],
            },
            {
                key: 'coverage_scope',
                label: 'Coverage Scope',
                test: /(guard|coverage|hours|shift|post|patrol|staff|staffing|scope|site|entrance|parking|access)/,
                recommendedResponse: 'Clarify scope by mapping guard posts, patrol zones, operating hours, and escalation needs to actual property risk.',
                playbook: [
                    'Confirm the highest-risk shifts, entrances, assets, and tenant touchpoints.',
                    'Separate fixed posts from patrols and supervisor coverage.',
                    'Use a site walkthrough to validate guard count and hours.',
                ],
            },
            {
                key: 'compliance_contract',
                label: 'Compliance and Contract',
                test: /(insurance|license|compliance|contract|terms|legal|sla|indemnity|certificate|policy)/,
                recommendedResponse: 'Reduce friction by preparing compliance proof, insurance details, service terms, and approval documents early.',
                playbook: [
                    'Ask which documents procurement or legal needs before approval.',
                    'Share licenses, insurance, service levels, and reporting commitments.',
                    'Confirm contract review steps before proposal delivery.',
                ],
            },
            {
                key: 'risk_value',
                label: 'Risk and Value',
                test: /(need|why|value|risk|incident|liability|roi|worth|benefit|problem|concern)/,
                recommendedResponse: 'Make the business case around reduced incidents, liability control, tenant confidence, and management visibility.',
                playbook: [
                    'Ask which risk the buyer most wants removed.',
                    'Connect each guard recommendation to a risk, location, or operating window.',
                    'Summarize value in operational outcomes, not only guard presence.',
                ],
            },
        ];
        const definition = definitions.find((item) => item.test.test(normalized)) ||
            {
                key: 'general_objection',
                label: 'General Objection',
                recommendedResponse: 'Clarify the concern, quantify impact, and connect the response back to property risk and buyer priorities.',
                playbook: [
                    'Ask what would need to be true for the buyer to move forward.',
                    'Restate the concern in business terms before answering.',
                    'Agree on the next proof point or decision step.',
                ],
            };
        return {
            key: definition.key,
            label: definition.label,
            recommendedResponse: definition.recommendedResponse,
            playbook: definition.playbook,
        };
    }
    objectionSeverity(key, count, lossRate) {
        if ((lossRate ?? 0) >= 67 && count >= 2)
            return 'high';
        if (count >= 5)
            return 'high';
        if (count >= 3 &&
            ['price_budget', 'decision_authority', 'service_quality'].includes(key)) {
            return 'high';
        }
        if (count >= 2)
            return 'medium';
        return 'low';
    }
    dealOutcome(stage) {
        if (this.isClosedWonStage(stage))
            return 'won';
        if (this.isClosedLostStage(stage))
            return 'lost';
        return 'open';
    }
    objectionOutcomeSignal(label, lostDealCount, wonDealCount, openDealCount, lossRate) {
        if (lossRate === null) {
            return openDealCount > 0
                ? `${label} is active in ${openDealCount} open deal${openDealCount === 1 ? '' : 's'}, but closed outcome data is not available yet.`
                : 'No closed-deal outcome signal is available for this objection yet.';
        }
        if (lossRate >= 67 && lostDealCount >= 2) {
            return `${label} is strongly associated with closed-lost deals: ${lostDealCount} lost vs ${wonDealCount} won.`;
        }
        if (lossRate >= 50) {
            return `${label} is a watch item: ${lossRate}% of closed outcomes with this pattern are lost.`;
        }
        if (wonDealCount > lostDealCount) {
            return `${label} appears manageable when handled well: ${wonDealCount} won vs ${lostDealCount} lost.`;
        }
        return `${label} has limited closed outcome data so far: ${lostDealCount} lost vs ${wonDealCount} won.`;
    }
    dealForecast(deal, assessments, momentum) {
        const stage = deal.stage.toLowerCase();
        const sorted = [...assessments].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        const latest = sorted[0] ?? null;
        const previous = sorted[1] ?? null;
        const currentReadiness = latest?.closeReadinessScore ?? null;
        const previousReadiness = previous?.closeReadinessScore ?? null;
        const readinessChange = typeof currentReadiness === 'number' &&
            typeof previousReadiness === 'number'
            ? currentReadiness - previousReadiness
            : null;
        const trend = this.readinessTrend(readinessChange);
        const history = sorted
            .slice(0, 6)
            .reverse()
            .map((assessment) => ({
            id: assessment.id,
            score: assessment.closeReadinessScore,
            discoveryQualityScore: assessment.discoveryQualityScore,
            createdAt: assessment.createdAt,
        }));
        if (/lost|closed lost/.test(stage)) {
            return {
                status: 'closed_lost',
                label: 'Closed Lost',
                confidence: 100,
                probability: 0,
                currentReadiness,
                previousReadiness,
                readinessChange,
                trend,
                history,
                reasons: ['Deal is in a lost stage.'],
                recommendedAction: 'Capture loss reason and feed it back into future discovery.',
            };
        }
        if (/won|closed won/.test(stage)) {
            return {
                status: 'closed_won',
                label: 'Closed Won',
                confidence: 100,
                probability: 100,
                currentReadiness,
                previousReadiness,
                readinessChange,
                trend,
                history,
                reasons: ['Deal is in a won stage.'],
                recommendedAction: 'Hand off confirmed scope and risk context to operations.',
            };
        }
        if (!latest || typeof currentReadiness !== 'number') {
            return {
                status: 'unscored',
                label: 'Unscored',
                confidence: 0,
                probability: 0,
                currentReadiness: null,
                previousReadiness,
                readinessChange,
                trend: 'unknown',
                history,
                reasons: ['No close-readiness assessment has been generated yet.'],
                recommendedAction: 'Run Sales Accelerator scoring after discovery is captured.',
            };
        }
        const discoveryQuality = latest.discoveryQualityScore ?? 0;
        const reasons = [];
        let probability = currentReadiness;
        let confidence = 40 + Math.min(24, sorted.length * 6);
        if (trend === 'improving') {
            probability += 6;
            confidence += 8;
            reasons.push(`Readiness improved by ${readinessChange} points.`);
        }
        else if (trend === 'declining') {
            probability -= 10;
            confidence -= 6;
            reasons.push(`Readiness declined by ${Math.abs(readinessChange ?? 0)} points.`);
        }
        else if (trend === 'flat') {
            reasons.push('Readiness is stable against the previous assessment.');
        }
        else {
            reasons.push('Only one readiness assessment exists so trend confidence is limited.');
        }
        if (discoveryQuality >= 75) {
            confidence += 12;
            reasons.push('Discovery quality is strong.');
        }
        else if (discoveryQuality >= 50) {
            confidence += 5;
            reasons.push('Discovery quality is usable but can improve.');
        }
        else {
            probability -= 8;
            confidence -= 8;
            reasons.push('Discovery quality is weak.');
        }
        if (momentum?.status === 'healthy') {
            probability += 5;
            confidence += 6;
            reasons.push('Deal momentum is healthy.');
        }
        else if (momentum?.status === 'watch') {
            probability -= 4;
            reasons.push('Deal momentum needs watching.');
        }
        else if (momentum?.status === 'stalled') {
            probability -= 12;
            confidence -= 8;
            reasons.push('Deal momentum is stalled.');
        }
        else if (momentum?.status === 'urgent') {
            probability -= 18;
            confidence -= 12;
            reasons.push('Deal momentum is urgent.');
        }
        const forecastProbability = this.clamp(probability);
        const forecastConfidence = this.clamp(confidence);
        const status = this.forecastStatus(forecastProbability, forecastConfidence);
        return {
            status,
            label: this.forecastLabel(status),
            confidence: forecastConfidence,
            probability: forecastProbability,
            currentReadiness,
            previousReadiness,
            readinessChange,
            trend,
            history,
            reasons,
            recommendedAction: this.forecastAction(status, trend, latest.recommendedNextAction),
        };
    }
    readinessTrend(readinessChange) {
        if (typeof readinessChange !== 'number')
            return 'unknown';
        if (readinessChange >= 5)
            return 'improving';
        if (readinessChange <= -5)
            return 'declining';
        return 'flat';
    }
    forecastStatus(probability, confidence) {
        if (probability >= 80 && confidence >= 70)
            return 'commit';
        if (probability >= 65 && confidence >= 55)
            return 'likely';
        if (probability >= 45)
            return 'watch';
        return 'at_risk';
    }
    forecastLabel(status) {
        const labels = {
            commit: 'Commit',
            likely: 'Likely',
            watch: 'Watch',
            at_risk: 'At Risk',
            unscored: 'Unscored',
            closed_won: 'Closed Won',
            closed_lost: 'Closed Lost',
        };
        return labels[status];
    }
    forecastAction(status, trend, nextAction) {
        if (status === 'closed_won') {
            return 'Send confirmed scope, buyer priorities, and risk context to operations.';
        }
        if (status === 'closed_lost') {
            return 'Capture loss reason and compare it with objection patterns.';
        }
        if (status === 'unscored') {
            return 'Run close-readiness scoring after discovery is captured.';
        }
        if (trend === 'declining') {
            return nextAction || 'Revisit discovery gaps and confirm the approval path.';
        }
        if (status === 'commit') {
            return nextAction || 'Confirm final decision date and prepare handoff details.';
        }
        if (status === 'likely') {
            return nextAction || 'Lock the next buyer meeting and validate remaining risks.';
        }
        if (status === 'watch') {
            return nextAction || 'Improve discovery quality before treating this as forecastable.';
        }
        return nextAction || 'Create a recovery action tied to buyer risk and timeline.';
    }
    dealMomentum(deal, assessment) {
        const now = new Date();
        const stage = deal.stage.toLowerCase();
        const activities = deal.activities || [];
        const pendingActivities = activities.filter((activity) => activity.status.toLowerCase() !== 'completed');
        const overdueActivities = pendingActivities.filter((activity) => activity.dueDate && activity.dueDate.getTime() < now.getTime());
        const lastActivity = [...activities].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0] ?? null;
        const nextActivity = [...pendingActivities].sort((a, b) => (a.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER) -
            (b.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER))[0] ?? null;
        const daysOpen = this.daysBetween(deal.createdAt, now);
        const daysSinceActivity = lastActivity
            ? this.daysBetween(lastActivity.createdAt, now)
            : null;
        const isClosed = /(won|lost|closed)/.test(stage);
        const reasons = [];
        if (isClosed) {
            return {
                status: 'closed',
                score: 100,
                daysOpen,
                daysSinceActivity,
                overdueActivityCount: overdueActivities.length,
                pendingActivityCount: pendingActivities.length,
                nextActivity,
                lastActivity,
                reasons: ['Deal is in a closed stage.'],
                recommendedAction: 'No sales momentum action required.',
            };
        }
        let score = 100;
        if (daysSinceActivity === null) {
            const penalty = daysOpen >= 7 ? 30 : 15;
            score -= penalty;
            reasons.push('No sales activity has been logged on this deal.');
        }
        else if (daysSinceActivity > 14) {
            score -= 35;
            reasons.push(`No logged activity for ${daysSinceActivity} days.`);
        }
        else if (daysSinceActivity > 7) {
            score -= 25;
            reasons.push(`No logged activity for ${daysSinceActivity} days.`);
        }
        else if (daysSinceActivity > 3) {
            score -= 10;
            reasons.push(`Last logged activity was ${daysSinceActivity} days ago.`);
        }
        else {
            reasons.push('Recent sales activity is logged.');
        }
        if (overdueActivities.length > 0) {
            score -= Math.min(35, overdueActivities.length * 15);
            reasons.push(`${overdueActivities.length} follow-up ${overdueActivities.length === 1 ? 'task is' : 'tasks are'} overdue.`);
        }
        if (pendingActivities.length === 0) {
            score -= 15;
            reasons.push('No pending next-step activity is scheduled.');
        }
        if (!deal.discoverySessions?.length) {
            score -= 10;
            reasons.push('No discovery session is captured for this deal.');
        }
        if ((assessment?.closeReadinessScore ?? 100) < 50) {
            score -= 20;
            reasons.push('Close readiness is below 50%.');
        }
        else if ((assessment?.closeReadinessScore ?? 100) < 70) {
            score -= 10;
            reasons.push('Close readiness is still below 70%.');
        }
        if ((assessment?.discoveryQualityScore ?? 100) < 50) {
            score -= 8;
            reasons.push('Discovery quality is below 50%.');
        }
        const momentumScore = this.clamp(score);
        let status = 'healthy';
        if (momentumScore < 35 ||
            overdueActivities.length >= 2 ||
            ((daysSinceActivity ?? 0) > 14 && pendingActivities.length === 0)) {
            status = 'urgent';
        }
        else if (momentumScore < 55 ||
            overdueActivities.length > 0 ||
            (daysSinceActivity ?? 0) > 10) {
            status = 'stalled';
        }
        else if (momentumScore < 75 ||
            pendingActivities.length === 0 ||
            (daysSinceActivity ?? 0) > 5) {
            status = 'watch';
        }
        return {
            status,
            score: momentumScore,
            daysOpen,
            daysSinceActivity,
            overdueActivityCount: overdueActivities.length,
            pendingActivityCount: pendingActivities.length,
            nextActivity,
            lastActivity,
            reasons: reasons.length ? reasons : ['Deal momentum is healthy.'],
            recommendedAction: this.momentumAction(status, overdueActivities.length, pendingActivities.length, daysSinceActivity, nextActivity, assessment),
        };
    }
    momentumAction(status, overdueActivityCount, pendingActivityCount, daysSinceActivity, nextActivity, assessment) {
        if (status === 'closed')
            return 'No sales momentum action required.';
        if (overdueActivityCount > 0) {
            return `Complete or reschedule ${overdueActivityCount} overdue follow-up ${overdueActivityCount === 1 ? 'task' : 'tasks'}.`;
        }
        if (pendingActivityCount === 0) {
            return (assessment?.recommendedNextAction ||
                'Create a dated follow-up task tied to the buyer decision timeline.');
        }
        if (daysSinceActivity === null) {
            return 'Log the first buyer touch and confirm the decision process.';
        }
        if (daysSinceActivity > 7) {
            return (assessment?.recommendedNextAction ||
                'Restart the conversation with a risk-framed follow-up and confirm the next meeting.');
        }
        if ((assessment?.closeReadinessScore ?? 100) < 70) {
            return (assessment?.recommendedNextAction ||
                'Fill the close-readiness gaps before sending another proposal update.');
        }
        if (nextActivity) {
            return `Prepare for next activity: ${nextActivity.subject}.`;
        }
        return 'Keep the next step dated and tied to the buyer approval path.';
    }
    async postCloseOperationsForClient(tenantId, clientId) {
        const postCloseLookback = this.daysAgo(90);
        const [incidents, shifts, invoices, reports] = await Promise.all([
            this.prisma.incident.findMany({
                where: {
                    tenantId,
                    occurredAt: { gte: postCloseLookback },
                    site: { clientId },
                },
                select: {
                    id: true,
                    title: true,
                    severity: true,
                    status: true,
                    occurredAt: true,
                    site: { select: { clientId: true, name: true } },
                },
            }),
            this.prisma.shift.findMany({
                where: {
                    tenantId,
                    startTime: { gte: postCloseLookback },
                    site: { clientId },
                },
                select: {
                    id: true,
                    status: true,
                    requiredGuards: true,
                    startTime: true,
                    site: { select: { clientId: true, name: true } },
                    assignments: { select: { status: true } },
                },
            }),
            this.prisma.invoice.findMany({
                where: {
                    tenantId,
                    clientId,
                    createdAt: { gte: postCloseLookback },
                },
                select: {
                    id: true,
                    status: true,
                    totalAmount: true,
                    dueDate: true,
                    clientId: true,
                },
            }),
            this.prisma.dailyServiceReport.findMany({
                where: {
                    tenantId,
                    clientId,
                    reportDate: { gte: postCloseLookback },
                },
                select: {
                    id: true,
                    status: true,
                    reportDate: true,
                    clientId: true,
                },
            }),
        ]);
        return { incidents, shifts, invoices, reports };
    }
    buildPostCloseOperationContexts(incidents, shifts, invoices, reports) {
        const contexts = new Map();
        const ensure = (clientId) => {
            if (!contexts.has(clientId)) {
                contexts.set(clientId, this.emptyPostCloseOperations());
            }
            return contexts.get(clientId);
        };
        incidents.forEach((incident) => {
            const clientId = incident.site?.clientId;
            if (clientId)
                ensure(clientId).incidents.push(incident);
        });
        shifts.forEach((shift) => {
            const clientId = shift.site?.clientId;
            if (clientId)
                ensure(clientId).shifts.push(shift);
        });
        invoices.forEach((invoice) => {
            ensure(invoice.clientId).invoices.push(invoice);
        });
        reports.forEach((report) => {
            ensure(report.clientId).reports.push(report);
        });
        return contexts;
    }
    emptyPostCloseOperations() {
        return {
            incidents: [],
            shifts: [],
            invoices: [],
            reports: [],
        };
    }
    postCloseFeedback(deal, discovery, operations) {
        const now = new Date();
        const highSeverityIncidentCount = operations.incidents.filter((incident) => /(high|critical|severe)/i.test(incident.severity)).length;
        const openShiftCount = operations.shifts.filter((shift) => /(open|unassigned|pending)/i.test(shift.status)).length;
        const understaffedShiftCount = operations.shifts.filter((shift) => {
            const assigned = shift.assignments.filter((assignment) => /(confirmed|assigned|accepted|completed)/i.test(assignment.status)).length;
            return assigned < shift.requiredGuards;
        }).length;
        const overdueInvoiceCount = operations.invoices.filter((invoice) => invoice.dueDate &&
            invoice.dueDate.getTime() < now.getTime() &&
            !/(paid|cancelled|void)/i.test(invoice.status)).length;
        const disputedInvoiceCount = operations.invoices.filter((invoice) => /disput/i.test(invoice.status)).length;
        const reportCount = operations.reports.length;
        const signals = [];
        const salesLessons = [];
        let score = 100;
        if (operations.incidents.length === 0 &&
            operations.shifts.length === 0 &&
            operations.invoices.length === 0 &&
            operations.reports.length === 0) {
            return {
                status: 'learning',
                score: 50,
                clientId: deal.client?.id || '',
                clientName: deal.client?.companyName || deal.client?.name || 'Client',
                dealId: deal.id,
                dealName: deal.name,
                incidentCount: 0,
                highSeverityIncidentCount: 0,
                openShiftCount: 0,
                understaffedShiftCount: 0,
                overdueInvoiceCount: 0,
                disputedInvoiceCount: 0,
                reportCount: 0,
                signals: ['No post-close operations data has been captured in the last 90 days.'],
                salesLessons: [
                    'Confirm that operations handoff, site setup, reporting cadence, and billing setup are captured after close.',
                ],
                recommendedAction: 'Ask operations to confirm whether the sold scope is active, staffed, and reporting correctly.',
            };
        }
        if (operations.incidents.length >= 3) {
            score -= 14;
            signals.push(`${operations.incidents.length} incidents logged after close.`);
            salesLessons.push('Discovery should quantify incident history and define escalation expectations before proposal.');
        }
        if (highSeverityIncidentCount > 0) {
            score -= Math.min(25, highSeverityIncidentCount * 10);
            signals.push(`${highSeverityIncidentCount} high-severity incident signal${highSeverityIncidentCount === 1 ? '' : 's'}.`);
            salesLessons.push('Risk framing may have been right, but the proposal should tighten patrol, post orders, and escalation controls.');
        }
        if (openShiftCount > 0) {
            score -= Math.min(20, openShiftCount * 5);
            signals.push(`${openShiftCount} open shift${openShiftCount === 1 ? '' : 's'} remain after close.`);
            salesLessons.push('Sales should validate staffing feasibility and launch timing before committing to coverage dates.');
        }
        if (understaffedShiftCount > 0) {
            score -= Math.min(28, understaffedShiftCount * 7);
            signals.push(`${understaffedShiftCount} shift${understaffedShiftCount === 1 ? '' : 's'} appear understaffed against required guard count.`);
            salesLessons.push('Guard count or coverage windows may have been scoped too tightly; future discovery should separate fixed posts from patrol coverage.');
        }
        if (overdueInvoiceCount > 0) {
            score -= Math.min(18, overdueInvoiceCount * 6);
            signals.push(`${overdueInvoiceCount} overdue invoice${overdueInvoiceCount === 1 ? '' : 's'} after close.`);
            salesLessons.push('Proposal and handoff should make billing cadence, approval steps, and payment expectations explicit.');
        }
        if (disputedInvoiceCount > 0) {
            score -= Math.min(25, disputedInvoiceCount * 10);
            signals.push(`${disputedInvoiceCount} disputed invoice${disputedInvoiceCount === 1 ? '' : 's'} after close.`);
            salesLessons.push('Pricing guardrails and scope assumptions need clearer language before signature.');
        }
        if (operations.shifts.length > 0 && reportCount === 0) {
            score -= 10;
            signals.push('Shifts exist, but no daily service reports are visible in the lookback window.');
            salesLessons.push('Sales should confirm reporting expectations during discovery and include them in the proposal.');
        }
        if (signals.length === 0) {
            signals.push('No major post-close friction detected in the last 90 days.');
            salesLessons.push('Use this deal as a positive pattern for similar property type, scope, and buyer expectations.');
        }
        if (discovery?.guardCount && understaffedShiftCount > 0) {
            salesLessons.push(`Original discovery captured ${discovery.guardCount} guard${discovery.guardCount === 1 ? '' : 's'}; compare that scope with actual staffing demand.`);
        }
        if (discovery?.riskConcerns?.length && operations.incidents.length > 0) {
            salesLessons.push(`Compare post-close incidents against sold risk concerns: ${this.displayList(discovery.riskConcerns)}.`);
        }
        const feedbackScore = this.clamp(score);
        const status = this.postCloseStatus(feedbackScore, highSeverityIncidentCount, understaffedShiftCount, disputedInvoiceCount);
        return {
            status,
            score: feedbackScore,
            clientId: deal.client?.id || '',
            clientName: deal.client?.companyName || deal.client?.name || 'Client',
            dealId: deal.id,
            dealName: deal.name,
            incidentCount: operations.incidents.length,
            highSeverityIncidentCount,
            openShiftCount,
            understaffedShiftCount,
            overdueInvoiceCount,
            disputedInvoiceCount,
            reportCount,
            signals: Array.from(new Set(signals)).slice(0, 6),
            salesLessons: Array.from(new Set(salesLessons)).slice(0, 6),
            recommendedAction: this.postCloseAction(status),
        };
    }
    postCloseStatus(score, highSeverityIncidentCount, understaffedShiftCount, disputedInvoiceCount) {
        if (score < 45 ||
            understaffedShiftCount >= 3 ||
            disputedInvoiceCount >= 2) {
            return 'oversold';
        }
        if (score < 65 || highSeverityIncidentCount > 0)
            return 'risk';
        if (score < 82)
            return 'watch';
        return 'healthy';
    }
    postCloseAction(status) {
        if (status === 'oversold') {
            return 'Review sold scope with operations and convert the gap into future discovery and proposal guardrails.';
        }
        if (status === 'risk') {
            return 'Compare discovery assumptions with post-close incidents, staffing, and billing friction.';
        }
        if (status === 'watch') {
            return 'Capture the operational friction and update sales coaching for similar future deals.';
        }
        if (status === 'learning') {
            return 'Confirm operations handoff data is being captured so sales can learn from the close.';
        }
        return 'Mark this as a positive pattern and reuse the winning discovery and scoping approach.';
    }
    pricingGuardrails(discovery, assessment, postCloseFeedback) {
        const scopeWarnings = [];
        const pricingRisks = [];
        const requiredClarifications = [];
        const recommendedTerms = [];
        let score = 100;
        if (!discovery) {
            return {
                status: 'blocked',
                confidenceScore: 0,
                floorGuidance: 'Do not price yet. Discovery is missing, so scope, risk, and staffing assumptions are unprotected.',
                scopeWarnings: ['No discovery session has been captured for this deal.'],
                pricingRisks: ['Any price would be guesswork and likely invite margin pressure.'],
                requiredClarifications: [
                    'Confirm property type, guard count, service hours, risk drivers, decision process, and budget sensitivity.',
                ],
                recommendedTerms: [
                    'Use placeholder pricing language until scope and assumptions are confirmed.',
                ],
                proposalInstruction: 'Block final pricing and present discovery requirements before proposal.',
            };
        }
        if (!discovery.guardCount) {
            score -= 18;
            requiredClarifications.push('Confirm required guard count or post count.');
            scopeWarnings.push('Guard count is missing.');
        }
        if (!discovery.serviceHours) {
            score -= 18;
            requiredClarifications.push('Confirm coverage days, shift windows, and holiday/weekend needs.');
            scopeWarnings.push('Service hours are missing.');
        }
        if (!discovery.riskConcerns.length) {
            score -= 14;
            requiredClarifications.push('Document the incidents, exposures, or liability concerns driving the purchase.');
            pricingRisks.push('Risk value is not quantified, so the buyer may compare only hourly rates.');
        }
        if (!discovery.painPoints.length) {
            score -= 10;
            requiredClarifications.push('Capture what is not working with the current security approach.');
        }
        if (!discovery.decisionTimeline) {
            score -= 8;
            requiredClarifications.push('Confirm decision deadline, desired start date, and approval sequence.');
        }
        if (!discovery.buyerRole) {
            score -= 8;
            requiredClarifications.push('Identify who owns scope, budget approval, and contract signature.');
        }
        if (!discovery.currentProvider) {
            score -= 5;
            requiredClarifications.push('Clarify whether an incumbent provider or existing contract affects pricing.');
        }
        const budgetText = discovery.budgetSensitivity?.toLowerCase() || '';
        if (/(tight|low|cheap|price|budget|sensitive|lowest)/.test(budgetText)) {
            score -= 14;
            pricingRisks.push('Budget sensitivity is explicit. Protect scope options from becoming an hourly-rate race.');
            recommendedTerms.push('Offer tiered scope options instead of discounting the required baseline coverage.');
        }
        const objections = [
            ...discovery.objections,
            ...(assessment?.objectionRisks || []),
        ];
        if (objections.some((item) => /(price|cost|budget|expensive|rate|quote)/i.test(item))) {
            score -= 12;
            pricingRisks.push('Price objection is already present. Anchor proposal language to risk reduction and accountability.');
        }
        if (objections.some((item) => /(contract|legal|terms|insurance|sla|indemnity)/i.test(item))) {
            score -= 8;
            recommendedTerms.push('Prepare insurance, licensing, service-level, and contract-review details before sending final pricing.');
        }
        if ((assessment?.discoveryQualityScore ?? 100) < 55) {
            score -= 10;
            scopeWarnings.push('Discovery quality is below 55, so proposal assumptions may be weak.');
        }
        if ((assessment?.closeReadinessScore ?? 100) < 55) {
            score -= 8;
            pricingRisks.push('Close readiness is low. Pricing should not be treated as the only remaining blocker.');
        }
        if (postCloseFeedback?.status === 'oversold') {
            score -= 16;
            scopeWarnings.push('Post-close feedback indicates similar work may have been oversold.');
            recommendedTerms.push('Add explicit assumptions, exclusions, startup dependencies, and change-order language.');
        }
        else if (postCloseFeedback?.status === 'risk') {
            score -= 8;
            scopeWarnings.push('Post-close operations feedback shows risk signals that should inform scope.');
        }
        if (discovery.guardCount && discovery.guardCount >= 4) {
            recommendedTerms.push('Separate base guard coverage from supervisor coverage, patrol routes, and add-on posts.');
        }
        if (/(24\/7|overnight|night|weekend|after hours)/i.test(discovery.serviceHours || '')) {
            recommendedTerms.push('Call out premium coverage windows, relief coverage, and supervision expectations.');
        }
        if (recommendedTerms.length === 0) {
            recommendedTerms.push('State assumptions clearly and reserve final pricing for confirmed scope and start date.');
        }
        if (scopeWarnings.length === 0) {
            scopeWarnings.push('No major scope gaps detected from captured discovery.');
        }
        if (pricingRisks.length === 0) {
            pricingRisks.push('No major pricing risk detected, but pricing should still be tied to risk and service outcomes.');
        }
        const confidenceScore = this.clamp(score);
        const status = this.pricingGuardrailStatus(confidenceScore);
        return {
            status,
            confidenceScore,
            floorGuidance: this.pricingFloorGuidance(status),
            scopeWarnings: Array.from(new Set(scopeWarnings)).slice(0, 6),
            pricingRisks: Array.from(new Set(pricingRisks)).slice(0, 6),
            requiredClarifications: Array.from(new Set(requiredClarifications)).slice(0, 6),
            recommendedTerms: Array.from(new Set(recommendedTerms)).slice(0, 6),
            proposalInstruction: this.pricingProposalInstruction(status),
        };
    }
    pricingGuardrailStatus(score) {
        if (score < 45)
            return 'blocked';
        if (score < 65)
            return 'protect_margin';
        if (score < 82)
            return 'review';
        return 'ready';
    }
    pricingFloorGuidance(status) {
        if (status === 'blocked') {
            return 'Do not issue final pricing until the missing scope and risk assumptions are clarified.';
        }
        if (status === 'protect_margin') {
            return 'Use a protected baseline scope, avoid discounting must-have coverage, and require change orders for added risk or hours.';
        }
        if (status === 'review') {
            return 'Pricing can proceed after a manager reviews scope assumptions, service hours, and buyer budget pressure.';
        }
        return 'Pricing is ready to frame around risk reduction, coverage accountability, and confirmed scope.';
    }
    pricingProposalInstruction(status) {
        if (status === 'blocked') {
            return 'Keep proposal pricing as pending and list the missing discovery items as next steps.';
        }
        if (status === 'protect_margin') {
            return 'Include pricing assumptions, exclusions, escalation terms, and optional scope tiers.';
        }
        if (status === 'review') {
            return 'Include a pricing assumptions section and confirm final scope before signature.';
        }
        return 'Include value-framed pricing language tied to risk, service quality, and confirmed coverage.';
    }
    isClosedWonStage(stage) {
        const normalized = stage.toLowerCase();
        return /(closed.?won|won)/.test(normalized) && !/lost/.test(normalized);
    }
    isClosedLostStage(stage) {
        const normalized = stage.toLowerCase();
        return /(closed.?lost|lost)/.test(normalized);
    }
    marketSignalProfile(context) {
        const discovery = context.discovery;
        const text = [
            context.lead.company,
            context.lead.status,
            context.deal?.name,
            context.deal?.stage,
            discovery?.propertyType,
            discovery?.buyerRole,
            discovery?.currentProvider,
            discovery?.serviceHours,
            discovery?.decisionTimeline,
            discovery?.budgetSensitivity,
            ...(discovery?.painPoints || []),
            ...(discovery?.riskConcerns || []),
            ...(discovery?.objections || []),
            discovery?.notes,
            ...(context.lead.notes || []).map((note) => note.content),
            ...(context.deal?.notes || []).map((note) => note.content),
        ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
        const segment = this.marketSegment(discovery?.propertyType, text);
        const indicators = [];
        const risks = [];
        let score = 30;
        if (segment !== 'Unknown') {
            score += 12;
            indicators.push(`${segment} property context identified.`);
        }
        else {
            risks.push('Property segment is not identified yet.');
        }
        if (discovery?.riskConcerns.length) {
            score += Math.min(18, discovery.riskConcerns.length * 6);
            indicators.push('Security risk drivers are captured.');
        }
        else if (/(incident|theft|liability|trespass|access|parking|risk|complaint)/i.test(text)) {
            score += 10;
            indicators.push('Risk language appears in notes.');
        }
        else {
            risks.push('No clear risk trigger is captured.');
        }
        const existingSecurityLikelihood = this.existingSecurityLikelihood(discovery, text);
        if (existingSecurityLikelihood === 'high') {
            score += 15;
            indicators.push('Existing security usage or incumbent provider is likely.');
        }
        else if (existingSecurityLikelihood === 'medium') {
            score += 8;
            indicators.push('Coverage details suggest a possible active security need.');
        }
        else {
            risks.push('Existing security usage is not confirmed.');
        }
        const renewalTimingSignal = this.renewalTimingSignal(discovery?.decisionTimeline, text);
        if (renewalTimingSignal === 'active') {
            score += 15;
            indicators.push('Active or urgent timing signal detected.');
        }
        else if (renewalTimingSignal === 'near_term') {
            score += 12;
            indicators.push('Near-term renewal, contract, RFP, or start-date signal detected.');
        }
        else if (renewalTimingSignal === 'future') {
            score += 5;
            indicators.push('Future timing signal exists, but urgency is limited.');
        }
        else {
            risks.push('Renewal or start-date timing is not confirmed.');
        }
        const decisionAuthoritySignal = this.decisionAuthoritySignal(discovery?.buyerRole, text);
        if (decisionAuthoritySignal === 'identified') {
            score += 10;
            indicators.push('Decision authority appears identified.');
        }
        else if (decisionAuthoritySignal === 'influencer') {
            score += 5;
            risks.push('Buyer may be an influencer rather than the final approver.');
        }
        else {
            risks.push('Decision authority is unknown.');
        }
        if (discovery?.guardCount) {
            score += Math.min(10, discovery.guardCount * 2);
            indicators.push('Guard count or post count is captured.');
        }
        if (discovery?.serviceHours) {
            score += 8;
            indicators.push('Coverage hours are captured.');
        }
        if (/(budget|price|cheap|lowest|expensive|rate)/i.test(discovery?.budgetSensitivity || text)) {
            score -= 8;
            risks.push('Price pressure is visible; value framing needs protection.');
        }
        const signalScore = this.clamp(score);
        return {
            score: signalScore,
            segment,
            existingSecurityLikelihood,
            renewalTimingSignal,
            decisionAuthoritySignal,
            indicators: Array.from(new Set(indicators)).slice(0, 6),
            risks: Array.from(new Set(risks)).slice(0, 6),
            recommendedAction: this.marketSignalAction(signalScore, renewalTimingSignal, existingSecurityLikelihood, decisionAuthoritySignal),
        };
    }
    marketSegment(propertyType, text = '') {
        const source = `${propertyType || ''} ${text}`.toLowerCase();
        if (/(apartment|residential|hoa|condo|multifamily)/.test(source))
            return 'Residential';
        if (/(warehouse|industrial|manufacturing|logistics|distribution)/.test(source))
            return 'Industrial';
        if (/(retail|mall|shopping|store|plaza)/.test(source))
            return 'Retail';
        if (/(office|commercial|corporate|business park)/.test(source))
            return 'Commercial';
        if (/(construction|jobsite|site development)/.test(source))
            return 'Construction';
        if (/(hospital|clinic|healthcare|medical)/.test(source))
            return 'Healthcare';
        if (/(school|campus|university|education)/.test(source))
            return 'Education';
        if (/(hotel|hospitality|event|venue)/.test(source))
            return 'Hospitality';
        if (/(parking|garage|lot)/.test(source))
            return 'Parking';
        return 'Unknown';
    }
    existingSecurityLikelihood(discovery, text = '') {
        if (discovery?.currentProvider)
            return 'high';
        if (/(incumbent|current provider|security vendor|guard company|contract renewal|existing contract|already have security)/.test(text)) {
            return 'high';
        }
        if (discovery?.guardCount || discovery?.serviceHours || /(guard|patrol|post order|coverage|shift)/.test(text)) {
            return 'medium';
        }
        if (text)
            return 'low';
        return 'unknown';
    }
    renewalTimingSignal(timeline, text = '') {
        const source = `${timeline || ''} ${text}`.toLowerCase();
        if (/(asap|urgent|immediate|this week|next week|start now|right away)/.test(source))
            return 'active';
        if (/(renewal|contract end|expires|expiration|rebid|rfp|bid|next month|30 days|60 days|quarter)/.test(source))
            return 'near_term';
        if (/(next year|later|future|six months|6 months|annual planning)/.test(source))
            return 'future';
        return 'unknown';
    }
    decisionAuthoritySignal(buyerRole, text = '') {
        const source = `${buyerRole || ''} ${text}`.toLowerCase();
        if (/(owner|president|ceo|director|vp|procurement|board|approver|sign off|decision maker|property manager|facilities manager)/.test(source)) {
            return 'identified';
        }
        if (/(assistant|coordinator|reception|office manager|tenant|supervisor)/.test(source)) {
            return 'influencer';
        }
        return 'unknown';
    }
    marketSignalAction(score, renewalTimingSignal, existingSecurityLikelihood, decisionAuthoritySignal) {
        if (score >= 75 && renewalTimingSignal !== 'unknown') {
            return 'Prioritize this opportunity and confirm scope, renewal/start date, and approval path immediately.';
        }
        if (existingSecurityLikelihood === 'high') {
            return 'Ask what they would change about the current provider and benchmark the incumbent against risk and accountability.';
        }
        if (decisionAuthoritySignal === 'unknown') {
            return 'Identify the budget owner, final approver, and anyone who can block the security decision.';
        }
        if (renewalTimingSignal === 'unknown') {
            return 'Confirm whether there is a contract renewal, incident trigger, RFP, or desired start date.';
        }
        return 'Use discovery to strengthen market fit, urgency, and decision authority before proposal.';
    }
    followUpSequence(context) {
        const discovery = context.discovery;
        const objectionsToAddress = this.cleanList([
            ...(discovery?.objections || []),
            ...(context.assessment?.objectionRisks || []),
        ]).slice(0, 5);
        const proposals = context.deal.proposals || [];
        const hasActiveProposal = proposals.some((proposal) => /(draft|sent|pending|review)/i.test(proposal.status));
        const pendingSequenceCount = (context.deal.activities || []).filter((activity) => activity.status !== 'completed' &&
            activity.subject.toLowerCase().includes('[sales sequence]')).length;
        const readiness = context.assessment?.closeReadinessScore;
        const valueScore = context.valueJustification?.score ?? 0;
        const marketScore = context.marketSignalProfile?.score ?? 0;
        const forecastProbability = context.forecast?.probability ?? 0;
        const baseScore = this.average([
            readiness ?? null,
            valueScore || null,
            marketScore || null,
            forecastProbability || null,
        ]);
        const sequenceScore = this.clamp((baseScore ?? 35) -
            pendingSequenceCount * 8 -
            (context.pricingGuardrails?.status === 'blocked' ? 20 : 0));
        const stopConditions = [
            'Buyer confirms approval, rejection, or a decision meeting.',
            'Scope, guard count, or coverage hours change enough to revise the proposal.',
            'A new pricing, contract, or procurement objection appears.',
        ];
        const step = (dayOffset, channel, subject, objective, description, priority) => ({
            dayOffset,
            channel,
            subject,
            objective,
            description,
            dueDate: this.dateAfter(dayOffset),
            priority,
        });
        if (!discovery ||
            context.pricingGuardrails?.status === 'blocked' ||
            context.valueJustification?.status === 'blocked') {
            const gaps = context.valueJustification?.discoveryGaps || [
                'Complete discovery before proposal follow-up.',
            ];
            return {
                status: 'blocked',
                cadence: 'standard',
                score: sequenceScore,
                recommendedAction: 'Do not automate proposal follow-up yet. Complete the missing discovery items first.',
                rationale: 'The opportunity does not have enough scope and value proof to support a proposal sequence.',
                objectionsToAddress,
                stopConditions,
                steps: [
                    step(1, 'task', 'Complete proposal-safe discovery', 'Capture the missing scope and value inputs before follow-up.', gaps.join('\n'), 'high'),
                    step(3, 'call', 'Confirm decision path and proposal blockers', 'Identify the buyer, approval path, and missing proposal requirements.', 'Ask who approves scope, budget, contract terms, and start date.', 'medium'),
                ],
            };
        }
        const rescueNeeded = ['urgent', 'stalled'].includes(context.momentum?.status || '') ||
            context.forecast?.status === 'at_risk';
        const proposalReady = hasActiveProposal ||
            context.valueJustification?.status === 'proposal_ready' ||
            ['commit', 'likely'].includes(context.forecast?.status || '');
        const accelerated = proposalReady &&
            (context.marketSignalProfile?.renewalTimingSignal === 'active' ||
                context.marketSignalProfile?.renewalTimingSignal === 'near_term' ||
                sequenceScore >= 75);
        const weakValueCase = context.valueJustification?.status === 'weak_value_case' ||
            (readiness ?? 0) < 45;
        if (rescueNeeded) {
            return {
                status: 'watch',
                cadence: 'rescue',
                score: sequenceScore,
                recommendedAction: 'Run a short rescue sequence focused on blockers, objections, and a clear decision checkpoint.',
                rationale: context.momentum?.recommendedAction ||
                    context.forecast?.recommendedAction ||
                    'Momentum or forecast signals show the deal may stall without direct follow-up.',
                objectionsToAddress,
                stopConditions,
                steps: [
                    step(0, 'call', 'Rescue stalled proposal decision', 'Surface the real blocker and secure a decision checkpoint.', 'Open with the value hypothesis, then ask what would prevent approval this week.', 'high'),
                    step(1, 'email', 'Send objection-specific value recap', 'Re-anchor the buyer on risk, scope, and cost of inaction.', [
                        context.valueJustification?.valueHypothesis,
                        context.valueJustification?.costOfInaction,
                        objectionsToAddress.length
                            ? `Address: ${objectionsToAddress.join('; ')}`
                            : null,
                    ]
                        .filter(Boolean)
                        .join('\n'), 'high'),
                    step(3, 'meeting', 'Decision checkpoint with approver', 'Get the buyer to approve, reject, or define the exact remaining step.', 'Invite all approval owners and confirm scope, pricing assumptions, and start date.', 'medium'),
                ],
            };
        }
        if (accelerated) {
            return {
                status: 'ready',
                cadence: 'accelerated',
                score: sequenceScore,
                recommendedAction: 'Use an accelerated proposal follow-up cadence and ask for a concrete decision checkpoint.',
                rationale: 'The value case, timing, and close-readiness signals are strong enough for direct proposal follow-up.',
                objectionsToAddress,
                stopConditions,
                steps: [
                    step(0, 'email', 'Send proposal value recap', 'Make the proposal easy to review and defend internally.', [
                        context.valueJustification?.proposalBullets.join('\n'),
                        context.pricingGuardrails?.proposalInstruction,
                    ]
                        .filter(Boolean)
                        .join('\n'), 'high'),
                    step(2, 'call', 'Confirm proposal review and blockers', 'Verify who reviewed the proposal and what remains to approve.', 'Ask for objections, procurement steps, contract review needs, and target start date.', 'high'),
                    step(5, 'meeting', 'Proposal decision checkpoint', 'Convert the review into a yes, no, or final revision list.', 'Review scope, assumptions, pricing guardrails, and timeline with the approval owner.', 'medium'),
                ],
            };
        }
        if (weakValueCase) {
            return {
                status: 'nurture',
                cadence: 'nurture',
                score: sequenceScore,
                recommendedAction: 'Nurture this opportunity with stronger risk proof before pushing a proposal decision.',
                rationale: 'The value case or readiness score is not strong enough for a hard proposal follow-up.',
                objectionsToAddress,
                stopConditions,
                steps: [
                    step(2, 'call', 'Re-qualify risk and buying urgency', 'Find the business reason for action and confirm whether timing is real.', 'Ask what incident, renewal, coverage gap, or stakeholder pressure is driving the conversation.', 'medium'),
                    step(5, 'email', 'Share risk and coverage proof', 'Build value before asking for a proposal decision.', context.valueJustification?.costOfInaction ||
                        'Send a concise security risk recap tied to their site conditions.', 'medium'),
                    step(10, 'task', 'Re-score opportunity after nurture touches', 'Decide whether the deal should move to proposal follow-up or stay in nurture.', 'Update discovery, run scoring, and confirm next action.', 'low'),
                ],
            };
        }
        return {
            status: 'ready',
            cadence: proposalReady ? 'standard' : 'nurture',
            score: sequenceScore,
            recommendedAction: 'Run a standard follow-up sequence that reinforces value, confirms blockers, and asks for the decision path.',
            rationale: 'The deal has enough value signal for structured follow-up, but not enough urgency for an accelerated cadence.',
            objectionsToAddress,
            stopConditions,
            steps: [
                step(1, 'email', 'Send value recap and next step', 'Summarize the security value case and ask for a review time.', context.valueJustification?.valueHypothesis ||
                    'Summarize the buyer risk, proposed coverage, and next step.', 'medium'),
                step(3, 'call', 'Walk through scope and pricing assumptions', 'Confirm that the proposal assumptions match the buyer expectation.', context.pricingGuardrails?.proposalInstruction ||
                    'Review coverage windows, guard count, supervision, reporting, and contract assumptions.', 'medium'),
                step(7, 'task', 'Confirm decision path', 'Document the next approver, procurement step, and target decision date.', 'If the buyer is unresponsive, decide whether to rescue, nurture, or pause the deal.', 'low'),
            ],
        };
    }
    valueJustification(context) {
        const discovery = context.discovery;
        if (!discovery) {
            return {
                status: 'blocked',
                score: 0,
                estimatedMonthlyGuardHours: null,
                scopeComplexity: 'unknown',
                valueHypothesis: 'No value case can be defended until discovery captures risk, scope, and buyer priorities.',
                costOfInaction: 'The buyer may default to hourly-rate comparison because the operational risk is not documented yet.',
                proofPoints: ['Discovery has not been captured.'],
                quantifiedInputs: ['No quantifiable scope inputs captured yet.'],
                discoveryGaps: [
                    'Capture property type, guard count, service hours, risk drivers, buyer role, decision timing, and budget sensitivity.',
                ],
                proposalBullets: [
                    'Keep proposal value language pending until the risk and scope story is confirmed.',
                ],
                recommendedAction: 'Run discovery before building ROI, value justification, or final proposal language.',
            };
        }
        const riskConcerns = this.cleanList(discovery.riskConcerns);
        const painPoints = this.cleanList(discovery.painPoints);
        const objections = this.cleanList([
            ...discovery.objections,
            ...(context.assessment?.objectionRisks || []),
        ]);
        const estimatedMonthlyGuardHours = this.estimatedMonthlyGuardHours(discovery.guardCount, discovery.serviceHours);
        const scopeComplexity = this.valueScopeComplexity(discovery.guardCount, estimatedMonthlyGuardHours, discovery.serviceHours);
        const discoveryGaps = this.valueDiscoveryGaps(discovery);
        const pricePressure = [
            discovery.budgetSensitivity,
            ...objections,
            discovery.notes,
        ].some((item) => /(price|cost|cheap|lowest|budget|expensive|rate|discount)/i.test(item || ''));
        const primaryRisk = riskConcerns[0] ||
            painPoints[0] ||
            discovery.propertyType ||
            'unquantified security exposure';
        const proofPoints = [
            ...riskConcerns.slice(0, 3).map((item) => `Risk driver: ${item}.`),
            ...painPoints.slice(0, 2).map((item) => `Operational pain: ${item}.`),
        ];
        if (discovery.currentProvider) {
            proofPoints.push(`Incumbent/provider context: ${discovery.currentProvider}.`);
        }
        if (context.marketSignalProfile?.segment && context.marketSignalProfile.segment !== 'Unknown') {
            proofPoints.push(`Market segment: ${context.marketSignalProfile.segment}.`);
        }
        if (estimatedMonthlyGuardHours !== null) {
            proofPoints.push(`Estimated monthly coverage load: ${estimatedMonthlyGuardHours} guard-hours.`);
        }
        if (context.postCloseFeedback?.signals.length) {
            proofPoints.push(`Post-close learning signal: ${context.postCloseFeedback.signals[0]}`);
        }
        if (proofPoints.length === 0) {
            proofPoints.push('Value proof is thin because risk, pain, and scope are not captured yet.');
        }
        const quantifiedInputs = [];
        if (discovery.propertyType)
            quantifiedInputs.push(`Property type: ${discovery.propertyType}.`);
        if (discovery.guardCount)
            quantifiedInputs.push(`Guard/post count: ${discovery.guardCount}.`);
        if (discovery.serviceHours)
            quantifiedInputs.push(`Coverage hours: ${discovery.serviceHours}.`);
        if (estimatedMonthlyGuardHours !== null) {
            quantifiedInputs.push(`Estimated monthly guard-hours: ${estimatedMonthlyGuardHours}.`);
        }
        if (discovery.decisionTimeline)
            quantifiedInputs.push(`Decision timing: ${discovery.decisionTimeline}.`);
        if (discovery.currentProvider)
            quantifiedInputs.push(`Current provider: ${discovery.currentProvider}.`);
        if (discovery.buyerRole)
            quantifiedInputs.push(`Buyer role: ${discovery.buyerRole}.`);
        if (context.forecast)
            quantifiedInputs.push(`Forecast probability: ${context.forecast.probability}%.`);
        if (context.pricingGuardrails) {
            quantifiedInputs.push(`Pricing guardrail: ${context.pricingGuardrails.status.replace('_', ' ')}.`);
        }
        if (quantifiedInputs.length === 0) {
            quantifiedInputs.push('No quantifiable scope inputs captured yet.');
        }
        const proposalBullets = [
            `Anchor the proposal around reducing ${primaryRisk}.`,
            'Connect guard coverage, supervision, reporting, and escalation process to the buyer risk.',
        ];
        if (estimatedMonthlyGuardHours !== null) {
            proposalBullets.push(`Show the coverage model as approximately ${estimatedMonthlyGuardHours} monthly guard-hours before pricing.`);
        }
        if (discovery.currentProvider) {
            proposalBullets.push('Compare the incumbent provider against accountability, reporting, and response expectations.');
        }
        if (pricePressure) {
            proposalBullets.push('Use good/better/best scope options instead of discounting required baseline coverage.');
        }
        if (context.pricingGuardrails?.status === 'blocked') {
            proposalBullets.push('Do not publish final pricing until missing scope assumptions are confirmed.');
        }
        let score = 25;
        score += Math.min(24, riskConcerns.length * 8);
        score += Math.min(18, painPoints.length * 6);
        if (estimatedMonthlyGuardHours !== null)
            score += 14;
        if (discovery.guardCount)
            score += 8;
        if (discovery.serviceHours)
            score += 8;
        if (discovery.buyerRole)
            score += 8;
        if (discovery.decisionTimeline)
            score += 6;
        if (context.marketSignalProfile) {
            score += Math.round((context.marketSignalProfile.score - 50) / 5);
        }
        if ((context.assessment?.closeReadinessScore ?? 0) >= 70)
            score += 6;
        if ((context.assessment?.discoveryQualityScore ?? 100) < 55)
            score -= 8;
        if (context.forecast?.status === 'commit' || context.forecast?.status === 'likely')
            score += 5;
        if (context.forecast?.status === 'at_risk')
            score -= 8;
        if (context.pricingGuardrails?.status === 'ready')
            score += 5;
        if (context.pricingGuardrails?.status === 'protect_margin')
            score -= 8;
        if (context.pricingGuardrails?.status === 'blocked')
            score -= 15;
        if (context.postCloseFeedback?.status === 'oversold')
            score -= 8;
        if (context.postCloseFeedback?.status === 'risk')
            score -= 4;
        if (pricePressure)
            score -= 8;
        score -= Math.min(24, discoveryGaps.length * 5);
        const valueScore = this.clamp(score);
        const status = this.valueJustificationStatus(valueScore, discoveryGaps.length, estimatedMonthlyGuardHours, riskConcerns.length + painPoints.length);
        return {
            status,
            score: valueScore,
            estimatedMonthlyGuardHours,
            scopeComplexity,
            valueHypothesis: this.valueHypothesis(context.entityType, discovery, context.marketSignalProfile, estimatedMonthlyGuardHours, primaryRisk),
            costOfInaction: this.valueCostOfInaction(primaryRisk, context.marketSignalProfile?.segment),
            proofPoints: Array.from(new Set(proofPoints)).slice(0, 6),
            quantifiedInputs: Array.from(new Set(quantifiedInputs)).slice(0, 7),
            discoveryGaps: Array.from(new Set(discoveryGaps)).slice(0, 7),
            proposalBullets: Array.from(new Set(proposalBullets)).slice(0, 6),
            recommendedAction: this.valueRecommendedAction(status, discoveryGaps, estimatedMonthlyGuardHours),
        };
    }
    valueJustificationStatus(score, gapCount, estimatedMonthlyGuardHours, proofCount) {
        if (score < 35)
            return 'blocked';
        if (score < 55 || proofCount === 0)
            return 'weak_value_case';
        if (score < 75 || gapCount > 1 || estimatedMonthlyGuardHours === null) {
            return 'needs_quantification';
        }
        return 'proposal_ready';
    }
    valueRecommendedAction(status, discoveryGaps, estimatedMonthlyGuardHours) {
        if (status === 'proposal_ready') {
            return 'Use this value case in the proposal and defend pricing with scope, risk, and coverage proof.';
        }
        if (status === 'needs_quantification') {
            return estimatedMonthlyGuardHours === null
                ? 'Quantify guard count and coverage hours before final pricing or ROI language.'
                : 'Close the remaining discovery gaps, then turn the proof points into proposal language.';
        }
        if (status === 'weak_value_case') {
            return 'Strengthen risk drivers, pain points, buyer outcomes, and success criteria before proposing.';
        }
        return discoveryGaps[0] || 'Complete discovery before building value justification.';
    }
    valueHypothesis(entityType, discovery, marketSignalProfile, estimatedMonthlyGuardHours, primaryRisk) {
        const segment = marketSignalProfile?.segment && marketSignalProfile.segment !== 'Unknown'
            ? marketSignalProfile.segment.toLowerCase()
            : discovery.propertyType || 'security';
        const scope = estimatedMonthlyGuardHours !== null
            ? ` across about ${estimatedMonthlyGuardHours} monthly guard-hours`
            : '';
        const motion = entityType === 'deal' ? 'proposal' : 'conversion';
        return `The ${motion} should frame ${segment} coverage${scope} as a way to reduce ${primaryRisk}, improve accountability, and make security performance visible.`;
    }
    valueCostOfInaction(primaryRisk, segment) {
        const source = `${primaryRisk} ${segment || ''}`.toLowerCase();
        if (/(theft|trespass|access|break.?in|vandal)/.test(source)) {
            return 'Unchecked access and property incidents can compound into losses, tenant complaints, insurance pressure, and emergency response costs.';
        }
        if (/(liability|safety|injury|incident|assault)/.test(source)) {
            return 'Weak prevention and response visibility can increase liability exposure and make incidents harder to defend after the fact.';
        }
        if (/(staff|coverage|post|shift|attendance|no.?show)/.test(source)) {
            return 'Coverage gaps can leave posts unattended, slow response, and erode confidence with tenants, staff, and visitors.';
        }
        if (/(retail|mall|parking|hospitality)/.test(source)) {
            return 'Poor site experience and visible disorder can affect customer trust, tenant satisfaction, and revenue-facing operations.';
        }
        return 'Without a quantified security value case, the buyer may delay action or compare vendors only by hourly rate.';
    }
    valueDiscoveryGaps(discovery) {
        const gaps = [];
        if (!discovery.guardCount)
            gaps.push('Confirm guard/post count.');
        if (!discovery.serviceHours)
            gaps.push('Confirm service hours and coverage windows.');
        if (!discovery.riskConcerns.length)
            gaps.push('Document specific risk drivers or incidents.');
        if (!discovery.painPoints.length)
            gaps.push('Capture what is not working today.');
        if (!discovery.buyerRole)
            gaps.push('Identify the buyer role and approval owner.');
        if (!discovery.decisionTimeline)
            gaps.push('Confirm decision timeline or desired start date.');
        if (!discovery.budgetSensitivity)
            gaps.push('Clarify budget sensitivity and value expectations.');
        return gaps;
    }
    valueScopeComplexity(guardCount, estimatedMonthlyGuardHours, serviceHours) {
        const text = serviceHours?.toLowerCase() || '';
        if (!guardCount && estimatedMonthlyGuardHours === null && !text)
            return 'unknown';
        if ((guardCount || 0) >= 6 ||
            (estimatedMonthlyGuardHours || 0) >= 1500 ||
            /(multi.?site|campus|24\/7|24x7|around.?the.?clock)/.test(text)) {
            return 'complex';
        }
        if ((guardCount || 0) >= 3 || (estimatedMonthlyGuardHours || 0) >= 650) {
            return 'expanded';
        }
        return 'standard';
    }
    estimatedMonthlyGuardHours(guardCount, serviceHours) {
        if (!guardCount || guardCount <= 0)
            return null;
        const weeklyHours = this.estimatedWeeklyServiceHours(serviceHours);
        if (weeklyHours === null)
            return null;
        return Math.round(guardCount * weeklyHours * 4.33);
    }
    estimatedWeeklyServiceHours(serviceHours) {
        const text = serviceHours?.toLowerCase() || '';
        if (!text)
            return null;
        if (/(24\s*\/\s*7|24x7|24-7|round.?the.?clock|around.?the.?clock)/.test(text)) {
            return 168;
        }
        const weekly = text.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\s*(?:\/|per)?\s*(?:week|weekly|wk)/);
        if (weekly)
            return Number(weekly[1]);
        const daily = text.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\s*(?:\/|per)?\s*(?:day|daily)/);
        if (daily) {
            const days = text.match(/(\d+(?:\.\d+)?)\s*(?:days?|d)\s*(?:\/|per)?\s*(?:week|weekly|wk)?/);
            return Number(daily[1]) * (days ? Number(days[1]) : 7);
        }
        const shift = text.match(/(\d+(?:\.\d+)?)\s*(?:hour|hr)\s*shift/);
        if (shift) {
            const days = text.match(/(\d+(?:\.\d+)?)\s*(?:days?|d)\s*(?:\/|per)?\s*(?:week|weekly|wk)?/);
            return Number(shift[1]) * (days ? Number(days[1]) : 5);
        }
        if (/(business hours|office hours)/.test(text))
            return 45;
        if (/(overnight|night)/.test(text) && /(weekend)/.test(text))
            return 40;
        if (/(overnight|night)/.test(text))
            return 56;
        if (/weekend/.test(text))
            return 24;
        return null;
    }
    valueJustificationContext(value) {
        return [
            'Value justification:',
            `Status: ${value.status}`,
            `Score: ${value.score}`,
            `Estimated monthly guard-hours: ${value.estimatedMonthlyGuardHours ?? 'unknown'}`,
            `Scope complexity: ${value.scopeComplexity}`,
            `Value hypothesis: ${value.valueHypothesis}`,
            `Cost of inaction: ${value.costOfInaction}`,
            `Proof points: ${value.proofPoints.join('; ')}`,
            `Proposal bullets: ${value.proposalBullets.join('; ')}`,
            `Discovery gaps: ${value.discoveryGaps.join('; ')}`,
        ].join('\n');
    }
    ruleAssessment(context) {
        const discovery = context.discovery;
        const missingQuestions = this.missingQuestions(discovery);
        const filled = 10 - missingQuestions.length;
        const discoveryQualityScore = Math.max(10, Math.min(100, filled * 10));
        const riskSignal = (discovery?.painPoints?.length || 0) * 6 +
            (discovery?.riskConcerns?.length || 0) * 8;
        const guardSignal = discovery?.guardCount ? Math.min(15, discovery.guardCount * 3) : 0;
        const buyerSignal = discovery?.buyerRole ? 10 : 0;
        const timelineSignal = this.timelineSignal(discovery?.decisionTimeline);
        const budgetPenalty = this.budgetPenalty(discovery?.budgetSensitivity);
        const objectionPenalty = Math.min(15, (discovery?.objections?.length || 0) * 5);
        const baseScore = 25 +
            discoveryQualityScore * 0.25 +
            riskSignal +
            guardSignal +
            buyerSignal +
            timelineSignal -
            budgetPenalty;
        const leadScore = this.clamp(baseScore);
        const closeReadinessScore = this.clamp(leadScore + (context.entityType === 'deal' ? 8 : 0) - objectionPenalty);
        const priorityTier = this.priorityTier(leadScore);
        const topRisk = discovery?.riskConcerns?.[0] ||
            discovery?.painPoints?.[0] ||
            'security exposure needs more discovery';
        return {
            leadScore,
            priorityTier,
            closeReadinessScore,
            discoveryQualityScore,
            riskProfile: `${context.lead.company} appears to be driven by ${topRisk}.`,
            proposalAngle: 'Position the service around risk reduction, accountable coverage, and operational visibility instead of hourly guard cost.',
            recommendedNextAction: missingQuestions.length > 0
                ? `Ask: ${missingQuestions[0]}`
                : context.entityType === 'deal'
                    ? 'Generate a risk-framed proposal and confirm the decision timeline.'
                    : 'Convert this lead to a deal once the buyer confirms scope and timeline.',
            missingQuestions,
            objectionRisks: discovery?.objections && discovery.objections.length > 0
                ? discovery.objections
                : budgetPenalty > 0
                    ? ['Budget sensitivity may create price pressure unless risk is quantified.']
                    : [],
            summary: `${priorityTier.toUpperCase()} priority with ${discoveryQualityScore}% discovery completeness and ${closeReadinessScore}% close readiness.`,
        };
    }
    mergeAssessmentDefaults(draft, fallback) {
        return {
            leadScore: this.clamp(draft.leadScore ?? fallback.leadScore),
            priorityTier: ['high', 'medium', 'low'].includes(draft.priorityTier)
                ? draft.priorityTier
                : fallback.priorityTier,
            closeReadinessScore: this.clamp(draft.closeReadinessScore ?? fallback.closeReadinessScore),
            discoveryQualityScore: this.clamp(draft.discoveryQualityScore ?? fallback.discoveryQualityScore),
            riskProfile: draft.riskProfile?.trim() || fallback.riskProfile,
            proposalAngle: draft.proposalAngle?.trim() || fallback.proposalAngle,
            recommendedNextAction: draft.recommendedNextAction?.trim() || fallback.recommendedNextAction,
            missingQuestions: this.cleanList(draft.missingQuestions).length
                ? this.cleanList(draft.missingQuestions)
                : fallback.missingQuestions,
            objectionRisks: this.cleanList(draft.objectionRisks),
            summary: draft.summary?.trim() || fallback.summary,
        };
    }
    assessmentDraftFromRecord(record) {
        return {
            leadScore: record.leadScore ?? 0,
            priorityTier: record.priorityTier === 'high' ||
                record.priorityTier === 'medium' ||
                record.priorityTier === 'low'
                ? record.priorityTier
                : 'medium',
            closeReadinessScore: record.closeReadinessScore ?? 0,
            discoveryQualityScore: record.discoveryQualityScore ?? 0,
            riskProfile: record.riskProfile || '',
            proposalAngle: record.proposalAngle || '',
            recommendedNextAction: record.recommendedNextAction || '',
            missingQuestions: record.missingQuestions,
            objectionRisks: record.objectionRisks,
            summary: record.summary || '',
        };
    }
    missingQuestions(discovery) {
        const questions = [];
        if (!discovery?.propertyType)
            questions.push('What type of property needs coverage?');
        if (!discovery?.buyerRole)
            questions.push('Who is the decision maker and what is their role?');
        if (!discovery?.guardCount)
            questions.push('How many guards or posts are required?');
        if (!discovery?.serviceHours)
            questions.push('Which days and hours need coverage?');
        if (!discovery?.riskConcerns?.length)
            questions.push('What risks or incidents are driving the security need?');
        if (!discovery?.decisionTimeline)
            questions.push('When does the client need service to start?');
        if (!discovery?.budgetSensitivity)
            questions.push('How sensitive is the buyer to price versus risk reduction?');
        if (!discovery?.currentProvider)
            questions.push('Are they using a current security provider?');
        if (!discovery?.painPoints?.length)
            questions.push('What is not working with their current security approach?');
        if (!discovery?.notes)
            questions.push('What success criteria should the proposal address?');
        return questions;
    }
    ruleDiscoveryGuide() {
        return {
            questions: [
                'What incidents, risks, or complaints triggered this security review?',
                'Which shifts, entrances, parking areas, or assets need the most coverage?',
                'Who approves the scope, budget, and start date?',
                'What would make the first 90 days of service successful?',
            ],
            talkingPoints: [
                'Frame the conversation around liability reduction and operational visibility.',
                'Tie every staffing recommendation to a property risk or coverage gap.',
                'Explain how reporting and escalation reduce management workload.',
            ],
            followUpAngles: [
                'Offer a site walkthrough to validate post orders and coverage windows.',
                'Send a proposal that maps risks to guard coverage and supervision controls.',
            ],
            qualificationChecklist: [
                'Decision maker identified',
                'Coverage hours confirmed',
                'Primary risks documented',
                'Timeline confirmed',
            ],
        };
    }
    ruleOutreachPlan() {
        return {
            callOpener: 'Hi, I am calling with a quick security coverage question. Are you the person who handles guard services or property risk?',
            talkingPoints: [
                'Lead with recent incidents, access-control gaps, or management workload.',
                'Ask about coverage windows and current provider pain before discussing guard count.',
                'Position a site walkthrough as the next low-friction step.',
            ],
            voicemailScript: 'Hi, I am calling about security coverage and risk at your property. I wanted to ask a few quick questions about current guard needs and whether a short coverage review would help. I will send a brief email as well.',
            emailSubject: 'Security coverage question',
            emailBody: 'Hi,\n\nI wanted to reach out about your security coverage needs. We help properties connect guard staffing, reporting, and escalation procedures to actual site risk and operating hours.\n\nWould a short coverage review or site walkthrough be useful?\n\nBest regards,',
            gatekeeperStrategy: 'Ask for facilities, property operations, risk, or vendor management. Keep the reason simple: a security coverage review.',
            bestCallWindow: 'Try mid-morning first, then send a short same-day email if the buyer is unavailable.',
            followUpPlan: [
                'Make one focused call with the risk-based opener.',
                'Send a concise email summarizing the coverage review offer.',
                'Follow up with a walkthrough or discovery-call request.',
            ],
        };
    }
    ruleDiscoveryLiveCoach(transcript) {
        const hasRisk = /(incident|risk|liability|theft|trespass|complaint|access|parking|after hours|break-in|vandal)/i.test(transcript);
        const hasScope = /(guard|coverage|hours|shift|post|patrol|24\/7|overnight|weekend)/i.test(transcript);
        const hasAuthority = /(owner|board|manager|director|committee|procurement|approval|approver|decision|sign off)/i.test(transcript);
        const hasTimeline = /(asap|urgent|start|timeline|deadline|next week|next month|quarter|renewal|contract end)/i.test(transcript);
        const hasBudget = /(budget|price|cost|rate|expensive|quote|bid|pricing)/i.test(transcript);
        const missedQuestions = [];
        const qualificationGaps = [];
        if (!hasRisk) {
            missedQuestions.push('What incidents, complaints, or risks triggered this security review?');
            qualificationGaps.push('Risk driver is not confirmed.');
        }
        if (!hasScope) {
            missedQuestions.push('Which posts, patrol areas, shifts, and service hours need coverage?');
            qualificationGaps.push('Coverage scope is not confirmed.');
        }
        if (!hasAuthority) {
            missedQuestions.push('Who approves the final scope, budget, and contract?');
            qualificationGaps.push('Decision authority is not mapped.');
        }
        if (!hasTimeline) {
            missedQuestions.push('When does coverage need to start, and what deadline is driving that timing?');
            qualificationGaps.push('Decision timeline is not confirmed.');
        }
        if (!hasBudget) {
            missedQuestions.push('How are you weighing budget against risk reduction and accountability?');
            qualificationGaps.push('Budget sensitivity is not understood.');
        }
        const captured = [hasRisk, hasScope, hasAuthority, hasTimeline, hasBudget].filter(Boolean).length;
        const completenessScore = Math.max(15, captured * 20);
        return {
            completenessScore,
            nextBestQuestion: missedQuestions[0] ||
                'What would make the first 90 days of this security program successful?',
            missedQuestions: missedQuestions.length > 0
                ? missedQuestions
                : ['Confirm success criteria and internal handoff needs before ending the call.'],
            livePrompts: [
                'Anchor the conversation on risk before discussing guard hours.',
                'Map each requested post or patrol to a specific exposure.',
                'Confirm who can approve or block the final scope.',
            ],
            qualificationGaps: qualificationGaps.length > 0
                ? qualificationGaps
                : ['Core qualification areas are mostly covered.'],
            riskPrompts: this.callSnippets(transcript, /(incident|risk|liability|theft|trespass|complaint|access|parking|after hours|break-in|vandal)/i, [
                'Ask which risk would be most costly if coverage fails.',
                'Ask where incidents or complaints happen most often.',
            ]),
            followUpAngles: [
                'Offer a site walkthrough to validate post orders and patrol routes.',
                'Send a risk-framed summary the buyer can forward to approvers.',
            ],
            coachingNote: completenessScore >= 80
                ? 'Discovery is strong enough to move toward a scoped proposal after confirming success criteria.'
                : 'Keep discovery open. The proposal is not protected until risk, scope, authority, and timing are clear.',
            confidenceScore: transcript.length > 500 ? 65 : transcript.length > 120 ? 50 : 35,
            shouldPauseProposal: completenessScore < 80,
        };
    }
    ruleDiscoveryCallIntelligence(transcript) {
        const summary = transcript
            .split(/\r?\n|[.!?]+/)
            .map((item) => item.trim())
            .find((item) => item.length > 20)
            ?.slice(0, 220) ||
            'Call notes captured. Confirm scope, buyer authority, risks, and next step before proposal.';
        const buyingSignals = this.callSnippets(transcript, /(interested|need|start|walkthrough|proposal|quote|approve|timeline|soon|urgent)/i, ['Buyer interest exists, but urgency and next step should be confirmed.']);
        const riskSignals = this.callSnippets(transcript, /(incident|risk|liability|theft|trespass|complaint|access|parking|after hours|break-in|vandal)/i, ['Security risk drivers need more detail before final scope.']);
        const objections = this.callSnippets(transcript, /(price|budget|cost|current provider|already have|approval|not now|contract|legal|procurement)/i);
        const decisionMakers = this.callSnippets(transcript, /(owner|board|manager|director|committee|procurement|approval|approver|decision|sign off)/i);
        const guardMatch = transcript.match(/(\d+)\s+(?:armed\s+|unarmed\s+)?guards?/i);
        const propertyMatch = transcript.match(/\b(apartment|warehouse|office|retail|construction|hospital|school|parking|mall|industrial|commercial|residential|hotel)\b/i);
        const roleMatch = transcript.match(/\b(owner|property manager|facilities manager|operations manager|director|procurement|board member|general manager)\b/i);
        return {
            summary,
            discovery: {
                propertyType: propertyMatch?.[0] ?? null,
                buyerRole: roleMatch?.[0] ?? null,
                currentProvider: null,
                guardCount: guardMatch ? Number(guardMatch[1]) : null,
                serviceHours: this.callSnippets(transcript, /(24\/7|overnight|after hours|business hours|weekend|weekday|shift|hours|evening|night)/i)[0] ?? null,
                painPoints: this.callSnippets(transcript, /(problem|pain|issue|missed|no show|turnover|complaint|poor|unreliable|slow)/i),
                riskConcerns: riskSignals,
                decisionTimeline: this.callSnippets(transcript, /(asap|urgent|start|timeline|deadline|next week|next month|quarter|renewal|contract end)/i)[0] ?? null,
                budgetSensitivity: this.callSnippets(transcript, /(budget|price|cost|rate|expensive|quote|bid|pricing)/i)[0] ?? null,
                objections,
                notes: summary,
            },
            buyingSignals,
            riskSignals,
            unansweredQuestions: [
                'Who signs off on the final scope and budget?',
                'What coverage hours and guard count are required?',
                'What start date or decision deadline should we plan around?',
            ],
            objections,
            decisionMakers,
            recommendedNextAction: 'Confirm missing scope details, decision authority, and timeline before drafting the proposal.',
            confidenceScore: transcript.length > 700 ? 55 : transcript.length > 250 ? 45 : 35,
        };
    }
    ruleProposal(company, discovery, assessment) {
        return `
# Security Services Proposal - ${company}

## Executive Summary
This proposal recommends a security guard program built around ${discovery.propertyType || 'the property'} risk reduction and accountable coverage.

## Risk Profile
${assessment?.riskProfile || this.displayList(discovery.riskConcerns) || 'The risk profile should be validated through final discovery.'}

## Recommended Scope
- Coverage need: ${discovery.serviceHours || 'To be confirmed'}
- Guard count: ${discovery.guardCount ?? 'To be confirmed'}
- Primary concerns: ${this.displayList(discovery.riskConcerns)}
- Current pain points: ${this.displayList(discovery.painPoints)}

## Staffing and Deployment Approach
The deployment should align guard posts, patrols, escalation procedures, and reporting cadence to the highest-risk hours and areas.

## Operational Controls
Recommended controls include post orders, supervisor review, incident escalation, daily reporting, and regular client checkpoints.

## Value Justification
${assessment?.proposalAngle || 'The service should be framed around reduced liability, better visibility, and consistent site control rather than guard hours alone.'}

## Next Steps
Confirm final coverage hours, decision timeline, and approval stakeholders, then finalize pricing and launch plan.
    `.trim();
    }
    timelineSignal(value) {
        const normalized = value?.toLowerCase() || '';
        if (!normalized)
            return 0;
        if (/(urgent|asap|immediate|week|30)/.test(normalized))
            return 12;
        if (/(month|quarter|60|90)/.test(normalized))
            return 7;
        return 4;
    }
    budgetPenalty(value) {
        const normalized = value?.toLowerCase() || '';
        if (/(high|price|tight|low|cheap|budget)/.test(normalized))
            return 10;
        if (/(medium|some)/.test(normalized))
            return 4;
        return 0;
    }
    priorityTier(score) {
        if (score >= 75)
            return 'high';
        if (score >= 50)
            return 'medium';
        return 'low';
    }
    clamp(value) {
        if (!Number.isFinite(value))
            return 0;
        return Math.max(0, Math.min(100, Math.round(value)));
    }
    daysBetween(start, end) {
        return Math.max(0, Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
    }
    daysAgo(days) {
        const date = new Date();
        date.setDate(date.getDate() - days);
        return date;
    }
    cleanString(value) {
        const trimmed = value?.trim();
        return trimmed || null;
    }
    cleanList(values) {
        return Array.from(new Set((values || [])
            .flatMap((value) => value.split('\n'))
            .map((value) => value.trim())
            .filter(Boolean))).slice(0, 12);
    }
    displayList(values) {
        return values && values.length > 0 ? values.join(', ') : 'None captured';
    }
    callSnippets(transcript, pattern, fallback = []) {
        const snippets = transcript
            .split(/\r?\n|[.!?]+/)
            .map((item) => item.trim())
            .filter((item) => item.length > 8 && pattern.test(item))
            .map((item) => item.slice(0, 180));
        const unique = Array.from(new Set(snippets)).slice(0, 5);
        return unique.length ? unique : fallback;
    }
    average(values) {
        const numeric = values.filter((value) => typeof value === 'number');
        if (numeric.length === 0)
            return null;
        return this.clamp(numeric.reduce((sum, value) => sum + value, 0) / numeric.length);
    }
    tomorrow() {
        const date = new Date();
        date.setDate(date.getDate() + 1);
        date.setHours(9, 0, 0, 0);
        return date;
    }
    dateAfter(days) {
        const date = new Date();
        if (days <= 0) {
            date.setHours(date.getHours() + 1, 0, 0, 0);
            return date;
        }
        date.setDate(date.getDate() + days);
        date.setHours(9, 0, 0, 0);
        return date;
    }
};
exports.SalesAcceleratorService = SalesAcceleratorService;
exports.SalesAcceleratorService = SalesAcceleratorService = SalesAcceleratorService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        ai_service_1.AiService,
        ai_monitoring_service_1.AiMonitoringService,
        audit_service_1.AuditService,
        activities_service_1.ActivitiesService,
        proposals_service_1.ProposalsService])
], SalesAcceleratorService);
//# sourceMappingURL=sales-accelerator.service.js.map