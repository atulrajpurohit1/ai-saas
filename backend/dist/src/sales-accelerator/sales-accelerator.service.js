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
const prisma_service_1 = require("../prisma/prisma.service");
const proposals_service_1 = require("../proposals/proposals.service");
let SalesAcceleratorService = SalesAcceleratorService_1 = class SalesAcceleratorService {
    prisma;
    aiService;
    aiMonitoringService;
    auditService;
    proposalsService;
    logger = new common_1.Logger(SalesAcceleratorService_1.name);
    constructor(prisma, aiService, aiMonitoringService, auditService, proposalsService) {
        this.prisma = prisma;
        this.aiService = aiService;
        this.aiMonitoringService = aiMonitoringService;
        this.auditService = auditService;
        this.proposalsService = proposalsService;
    }
    async getDashboard(tenantId) {
        const [leads, deals, recentAssessments] = await Promise.all([
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
                        select: { id: true, createdAt: true },
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
                    discoverySessions: {
                        orderBy: { createdAt: 'desc' },
                        take: 1,
                        select: { id: true, createdAt: true },
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
        ]);
        const assessedLeads = leads
            .map((lead) => ({ ...lead, assessment: lead.salesAssessments[0] ?? null }))
            .filter((lead) => lead.assessment);
        const assessedDeals = deals
            .map((deal) => ({ ...deal, assessment: deal.salesAssessments[0] ?? null }))
            .filter((deal) => deal.assessment);
        const topLeads = assessedLeads
            .sort((a, b) => (b.assessment?.leadScore ?? -1) - (a.assessment?.leadScore ?? -1))
            .slice(0, 5);
        const atRiskDeals = assessedDeals
            .sort((a, b) => (a.assessment?.closeReadinessScore ?? 101) -
            (b.assessment?.closeReadinessScore ?? 101))
            .slice(0, 5);
        return {
            generatedAt: new Date().toISOString(),
            metrics: {
                totalLeads: leads.length,
                totalDeals: deals.length,
                assessedLeads: assessedLeads.length,
                assessedDeals: assessedDeals.length,
                highPriorityLeads: assessedLeads.filter((lead) => lead.assessment?.priorityTier === 'high').length,
                dealsBelowReadiness: assessedDeals.filter((deal) => (deal.assessment?.closeReadinessScore ?? 100) < 50).length,
                leadsMissingDiscovery: leads.filter((lead) => lead.discoverySessions.length === 0).length,
                dealsMissingDiscovery: deals.filter((deal) => deal.discoverySessions.length === 0).length,
                averageLeadScore: this.average(assessedLeads.map((lead) => lead.assessment?.leadScore ?? null)),
                averageCloseReadiness: this.average(assessedDeals.map((deal) => deal.assessment?.closeReadinessScore ?? null)),
            },
            topLeads,
            atRiskDeals,
            recentAssessments,
        };
    }
    async getLeadWorkspace(tenantId, leadId) {
        const lead = await this.getLeadOrThrow(tenantId, leadId);
        const [discovery, assessment] = await Promise.all([
            this.latestDiscovery(tenantId, { leadId }),
            this.latestAssessment(tenantId, { leadId }),
        ]);
        return { lead, discovery, assessment };
    }
    async getDealWorkspace(tenantId, dealId) {
        const deal = await this.getDealOrThrow(tenantId, dealId);
        const [discovery, assessment] = await Promise.all([
            this.latestDiscovery(tenantId, { dealId }),
            this.latestAssessment(tenantId, { dealId }),
        ]);
        return { deal, discovery, assessment };
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
        if (!discovery) {
            throw new common_1.BadRequestException('Capture discovery details before generating a discovery-based proposal.');
        }
        const context = this.contextText({
            entityType: 'deal',
            lead: deal.lead,
            deal,
            discovery,
            assessment: assessment ? this.assessmentDraftFromRecord(assessment) : null,
        });
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
            generatedOutput: { content },
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
            aiGenerationId: generation?.id ?? null,
            fallbackUsed,
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
    average(values) {
        const numeric = values.filter((value) => typeof value === 'number');
        if (numeric.length === 0)
            return null;
        return this.clamp(numeric.reduce((sum, value) => sum + value, 0) / numeric.length);
    }
};
exports.SalesAcceleratorService = SalesAcceleratorService;
exports.SalesAcceleratorService = SalesAcceleratorService = SalesAcceleratorService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        ai_service_1.AiService,
        ai_monitoring_service_1.AiMonitoringService,
        audit_service_1.AuditService,
        proposals_service_1.ProposalsService])
], SalesAcceleratorService);
//# sourceMappingURL=sales-accelerator.service.js.map