import { Prisma } from '@prisma/client';
import { AiDiscoveryCallIntelligenceDraft, AiDiscoveryGuideDraft, AiDiscoveryLiveCoachDraft, AiOutreachDraft, AiService } from '../ai/ai.service';
import { AiMonitoringService } from '../ai-monitoring/ai-monitoring.service';
import { AuditService } from '../audit/audit.service';
import { ActivitiesService } from '../activities/activities.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProposalsService } from '../proposals/proposals.service';
import { AnalyzeDiscoveryCallDto } from './dto/analyze-discovery-call.dto';
import { CoachDiscoveryCallDto } from './dto/coach-discovery-call.dto';
import { CreateFollowUpTaskDto } from './dto/create-follow-up-task.dto';
import { GenerateDiscoveryProposalDto } from './dto/generate-discovery-proposal.dto';
import { SaveDiscoveryDto } from './dto/save-discovery.dto';
export interface ActivitySnapshot {
    id: string;
    type: string;
    subject: string;
    status: string;
    dueDate: Date | null;
    createdAt: Date;
}
export interface DealMomentum {
    status: 'healthy' | 'watch' | 'stalled' | 'urgent' | 'closed';
    score: number;
    daysOpen: number;
    daysSinceActivity: number | null;
    overdueActivityCount: number;
    pendingActivityCount: number;
    nextActivity: ActivitySnapshot | null;
    lastActivity: ActivitySnapshot | null;
    reasons: string[];
    recommendedAction: string;
}
export interface ForecastHistoryPoint {
    id: string;
    score: number | null;
    discoveryQualityScore: number | null;
    createdAt: Date;
}
export interface DealForecast {
    status: 'commit' | 'likely' | 'watch' | 'at_risk' | 'unscored' | 'closed_won' | 'closed_lost';
    label: string;
    confidence: number;
    probability: number;
    currentReadiness: number | null;
    previousReadiness: number | null;
    readinessChange: number | null;
    trend: 'improving' | 'flat' | 'declining' | 'unknown';
    history: ForecastHistoryPoint[];
    reasons: string[];
    recommendedAction: string;
}
export interface PostCloseFeedback {
    status: 'healthy' | 'watch' | 'risk' | 'oversold' | 'learning';
    score: number;
    clientId: string;
    clientName: string;
    dealId: string;
    dealName: string;
    incidentCount: number;
    highSeverityIncidentCount: number;
    openShiftCount: number;
    understaffedShiftCount: number;
    overdueInvoiceCount: number;
    disputedInvoiceCount: number;
    reportCount: number;
    signals: string[];
    salesLessons: string[];
    recommendedAction: string;
}
export interface PricingGuardrails {
    status: 'ready' | 'review' | 'protect_margin' | 'blocked';
    confidenceScore: number;
    floorGuidance: string;
    scopeWarnings: string[];
    pricingRisks: string[];
    requiredClarifications: string[];
    recommendedTerms: string[];
    proposalInstruction: string;
}
export interface MarketSignalProfile {
    score: number;
    segment: string;
    existingSecurityLikelihood: 'high' | 'medium' | 'low' | 'unknown';
    renewalTimingSignal: 'active' | 'near_term' | 'future' | 'unknown';
    decisionAuthoritySignal: 'identified' | 'influencer' | 'unknown';
    indicators: string[];
    risks: string[];
    recommendedAction: string;
}
export interface ValueJustification {
    status: 'proposal_ready' | 'needs_quantification' | 'weak_value_case' | 'blocked';
    score: number;
    estimatedMonthlyGuardHours: number | null;
    scopeComplexity: 'standard' | 'expanded' | 'complex' | 'unknown';
    valueHypothesis: string;
    costOfInaction: string;
    proofPoints: string[];
    quantifiedInputs: string[];
    discoveryGaps: string[];
    proposalBullets: string[];
    recommendedAction: string;
}
export interface FollowUpSequenceStep {
    dayOffset: number;
    channel: 'call' | 'email' | 'meeting' | 'task';
    subject: string;
    objective: string;
    description: string;
    dueDate: Date;
    priority: 'high' | 'medium' | 'low';
}
export interface FollowUpSequence {
    status: 'ready' | 'watch' | 'nurture' | 'blocked';
    cadence: 'accelerated' | 'standard' | 'nurture' | 'rescue';
    score: number;
    recommendedAction: string;
    rationale: string;
    steps: FollowUpSequenceStep[];
    objectionsToAddress: string[];
    stopConditions: string[];
}
export interface SalesCoachSummary {
    score: number;
    status: 'strong' | 'watch' | 'at_risk';
    headline: string;
    focusAreas: string[];
    coachingActions: string[];
    pipelineRisks: string[];
    positiveSignals: string[];
}
export interface ObjectionPattern {
    key: string;
    label: string;
    count: number;
    severity: 'high' | 'medium' | 'low';
    lostDealCount: number;
    wonDealCount: number;
    openDealCount: number;
    lossRate: number | null;
    outcomeSignal: string;
    examples: string[];
    recommendedResponse: string;
    playbook: string[];
    relatedLeads: Array<{
        id: string;
        name: string;
        company: string;
        status: string;
    }>;
    relatedDeals: Array<{
        id: string;
        name: string;
        stage: string;
        company: string;
    }>;
}
export declare class SalesAcceleratorService {
    private readonly prisma;
    private readonly aiService;
    private readonly aiMonitoringService;
    private readonly auditService;
    private readonly activitiesService;
    private readonly proposalsService;
    private readonly logger;
    constructor(prisma: PrismaService, aiService: AiService, aiMonitoringService: AiMonitoringService, auditService: AuditService, activitiesService: ActivitiesService, proposalsService: ProposalsService);
    getDashboard(tenantId: string): Promise<{
        generatedAt: string;
        salesCoachSummary: SalesCoachSummary;
        metrics: {
            totalLeads: number;
            totalDeals: number;
            assessedLeads: number;
            assessedDeals: number;
            highPriorityLeads: number;
            dealsBelowReadiness: number;
            stalledDeals: number;
            overdueDealActivities: number;
            trackedObjections: number;
            objectionPatternCount: number;
            forecastAtRiskDeals: number;
            postCloseReviewedDeals: number;
            postCloseRiskDeals: number;
            postCloseLearningDeals: number;
            averageForecastConfidence: number | null;
            leadsMissingDiscovery: number;
            dealsMissingDiscovery: number;
            averageLeadScore: number | null;
            averageCloseReadiness: number | null;
        };
        topLeads: {
            assessment: {
                id: string;
                createdAt: Date;
                leadScore: number | null;
                priorityTier: string | null;
                closeReadinessScore: number | null;
                discoveryQualityScore: number | null;
                riskProfile: string | null;
                proposalAngle: string | null;
                recommendedNextAction: string | null;
                missingQuestions: string[];
                objectionRisks: string[];
                summary: string | null;
            };
            marketSignalProfile: MarketSignalProfile;
            id: string;
            name: string;
            createdAt: Date;
            discoverySessions: {
                id: string;
                createdAt: Date;
                notes: string | null;
                guardCount: number | null;
                objections: string[];
                propertyType: string | null;
                buyerRole: string | null;
                currentProvider: string | null;
                serviceHours: string | null;
                painPoints: string[];
                riskConcerns: string[];
                decisionTimeline: string | null;
                budgetSensitivity: string | null;
            }[];
            salesAssessments: {
                id: string;
                createdAt: Date;
                leadScore: number | null;
                priorityTier: string | null;
                closeReadinessScore: number | null;
                discoveryQualityScore: number | null;
                riskProfile: string | null;
                proposalAngle: string | null;
                recommendedNextAction: string | null;
                missingQuestions: string[];
                objectionRisks: string[];
                summary: string | null;
            }[];
            status: string;
            company: string;
        }[];
        atRiskDeals: {
            assessment: {
                id: string;
                createdAt: Date;
                leadScore: number | null;
                priorityTier: string | null;
                closeReadinessScore: number | null;
                discoveryQualityScore: number | null;
                riskProfile: string | null;
                proposalAngle: string | null;
                recommendedNextAction: string | null;
                missingQuestions: string[];
                objectionRisks: string[];
                summary: string | null;
            };
            momentum: DealMomentum;
            forecast: DealForecast;
            marketSignalProfile: MarketSignalProfile;
            id: string;
            name: string;
            createdAt: Date;
            activities: {
                id: string;
                createdAt: Date;
                status: string;
                subject: string;
                type: string;
                dueDate: Date | null;
            }[];
            discoverySessions: {
                id: string;
                createdAt: Date;
                notes: string | null;
                guardCount: number | null;
                objections: string[];
                propertyType: string | null;
                buyerRole: string | null;
                currentProvider: string | null;
                serviceHours: string | null;
                painPoints: string[];
                riskConcerns: string[];
                decisionTimeline: string | null;
                budgetSensitivity: string | null;
            }[];
            salesAssessments: {
                id: string;
                createdAt: Date;
                leadScore: number | null;
                priorityTier: string | null;
                closeReadinessScore: number | null;
                discoveryQualityScore: number | null;
                riskProfile: string | null;
                proposalAngle: string | null;
                recommendedNextAction: string | null;
                missingQuestions: string[];
                objectionRisks: string[];
                summary: string | null;
            }[];
            client: {
                id: string;
                name: string;
                companyName: string | null;
            } | null;
            lead: {
                id: string;
                name: string;
                company: string;
            };
            stage: string;
        }[];
        stalledDeals: {
            assessment: {
                id: string;
                createdAt: Date;
                leadScore: number | null;
                priorityTier: string | null;
                closeReadinessScore: number | null;
                discoveryQualityScore: number | null;
                riskProfile: string | null;
                proposalAngle: string | null;
                recommendedNextAction: string | null;
                missingQuestions: string[];
                objectionRisks: string[];
                summary: string | null;
            };
            momentum: DealMomentum;
            forecast: DealForecast;
            marketSignalProfile: MarketSignalProfile;
            id: string;
            name: string;
            createdAt: Date;
            activities: {
                id: string;
                createdAt: Date;
                status: string;
                subject: string;
                type: string;
                dueDate: Date | null;
            }[];
            discoverySessions: {
                id: string;
                createdAt: Date;
                notes: string | null;
                guardCount: number | null;
                objections: string[];
                propertyType: string | null;
                buyerRole: string | null;
                currentProvider: string | null;
                serviceHours: string | null;
                painPoints: string[];
                riskConcerns: string[];
                decisionTimeline: string | null;
                budgetSensitivity: string | null;
            }[];
            salesAssessments: {
                id: string;
                createdAt: Date;
                leadScore: number | null;
                priorityTier: string | null;
                closeReadinessScore: number | null;
                discoveryQualityScore: number | null;
                riskProfile: string | null;
                proposalAngle: string | null;
                recommendedNextAction: string | null;
                missingQuestions: string[];
                objectionRisks: string[];
                summary: string | null;
            }[];
            client: {
                id: string;
                name: string;
                companyName: string | null;
            } | null;
            lead: {
                id: string;
                name: string;
                company: string;
            };
            stage: string;
        }[];
        forecastRiskDeals: {
            assessment: {
                id: string;
                createdAt: Date;
                leadScore: number | null;
                priorityTier: string | null;
                closeReadinessScore: number | null;
                discoveryQualityScore: number | null;
                riskProfile: string | null;
                proposalAngle: string | null;
                recommendedNextAction: string | null;
                missingQuestions: string[];
                objectionRisks: string[];
                summary: string | null;
            };
            momentum: DealMomentum;
            forecast: DealForecast;
            marketSignalProfile: MarketSignalProfile;
            id: string;
            name: string;
            createdAt: Date;
            activities: {
                id: string;
                createdAt: Date;
                status: string;
                subject: string;
                type: string;
                dueDate: Date | null;
            }[];
            discoverySessions: {
                id: string;
                createdAt: Date;
                notes: string | null;
                guardCount: number | null;
                objections: string[];
                propertyType: string | null;
                buyerRole: string | null;
                currentProvider: string | null;
                serviceHours: string | null;
                painPoints: string[];
                riskConcerns: string[];
                decisionTimeline: string | null;
                budgetSensitivity: string | null;
            }[];
            salesAssessments: {
                id: string;
                createdAt: Date;
                leadScore: number | null;
                priorityTier: string | null;
                closeReadinessScore: number | null;
                discoveryQualityScore: number | null;
                riskProfile: string | null;
                proposalAngle: string | null;
                recommendedNextAction: string | null;
                missingQuestions: string[];
                objectionRisks: string[];
                summary: string | null;
            }[];
            client: {
                id: string;
                name: string;
                companyName: string | null;
            } | null;
            lead: {
                id: string;
                name: string;
                company: string;
            };
            stage: string;
        }[];
        postCloseFeedbackDeals: {
            postCloseFeedback: PostCloseFeedback;
            assessment: {
                id: string;
                createdAt: Date;
                leadScore: number | null;
                priorityTier: string | null;
                closeReadinessScore: number | null;
                discoveryQualityScore: number | null;
                riskProfile: string | null;
                proposalAngle: string | null;
                recommendedNextAction: string | null;
                missingQuestions: string[];
                objectionRisks: string[];
                summary: string | null;
            };
            momentum: DealMomentum;
            forecast: DealForecast;
            marketSignalProfile: MarketSignalProfile;
            id: string;
            name: string;
            createdAt: Date;
            activities: {
                id: string;
                createdAt: Date;
                status: string;
                subject: string;
                type: string;
                dueDate: Date | null;
            }[];
            discoverySessions: {
                id: string;
                createdAt: Date;
                notes: string | null;
                guardCount: number | null;
                objections: string[];
                propertyType: string | null;
                buyerRole: string | null;
                currentProvider: string | null;
                serviceHours: string | null;
                painPoints: string[];
                riskConcerns: string[];
                decisionTimeline: string | null;
                budgetSensitivity: string | null;
            }[];
            salesAssessments: {
                id: string;
                createdAt: Date;
                leadScore: number | null;
                priorityTier: string | null;
                closeReadinessScore: number | null;
                discoveryQualityScore: number | null;
                riskProfile: string | null;
                proposalAngle: string | null;
                recommendedNextAction: string | null;
                missingQuestions: string[];
                objectionRisks: string[];
                summary: string | null;
            }[];
            client: {
                id: string;
                name: string;
                companyName: string | null;
            } | null;
            lead: {
                id: string;
                name: string;
                company: string;
            };
            stage: string;
        }[];
        objectionPatterns: ObjectionPattern[];
        missingDiscoveryLeads: {
            id: string;
            name: string;
            createdAt: Date;
            discoverySessions: {
                id: string;
                createdAt: Date;
                notes: string | null;
                guardCount: number | null;
                objections: string[];
                propertyType: string | null;
                buyerRole: string | null;
                currentProvider: string | null;
                serviceHours: string | null;
                painPoints: string[];
                riskConcerns: string[];
                decisionTimeline: string | null;
                budgetSensitivity: string | null;
            }[];
            salesAssessments: {
                id: string;
                createdAt: Date;
                leadScore: number | null;
                priorityTier: string | null;
                closeReadinessScore: number | null;
                discoveryQualityScore: number | null;
                riskProfile: string | null;
                proposalAngle: string | null;
                recommendedNextAction: string | null;
                missingQuestions: string[];
                objectionRisks: string[];
                summary: string | null;
            }[];
            status: string;
            company: string;
        }[];
        missingDiscoveryDeals: {
            assessment: {
                id: string;
                createdAt: Date;
                leadScore: number | null;
                priorityTier: string | null;
                closeReadinessScore: number | null;
                discoveryQualityScore: number | null;
                riskProfile: string | null;
                proposalAngle: string | null;
                recommendedNextAction: string | null;
                missingQuestions: string[];
                objectionRisks: string[];
                summary: string | null;
            };
            momentum: DealMomentum;
            forecast: DealForecast;
            marketSignalProfile: MarketSignalProfile;
            id: string;
            name: string;
            createdAt: Date;
            activities: {
                id: string;
                createdAt: Date;
                status: string;
                subject: string;
                type: string;
                dueDate: Date | null;
            }[];
            discoverySessions: {
                id: string;
                createdAt: Date;
                notes: string | null;
                guardCount: number | null;
                objections: string[];
                propertyType: string | null;
                buyerRole: string | null;
                currentProvider: string | null;
                serviceHours: string | null;
                painPoints: string[];
                riskConcerns: string[];
                decisionTimeline: string | null;
                budgetSensitivity: string | null;
            }[];
            salesAssessments: {
                id: string;
                createdAt: Date;
                leadScore: number | null;
                priorityTier: string | null;
                closeReadinessScore: number | null;
                discoveryQualityScore: number | null;
                riskProfile: string | null;
                proposalAngle: string | null;
                recommendedNextAction: string | null;
                missingQuestions: string[];
                objectionRisks: string[];
                summary: string | null;
            }[];
            client: {
                id: string;
                name: string;
                companyName: string | null;
            } | null;
            lead: {
                id: string;
                name: string;
                company: string;
            };
            stage: string;
        }[];
        recentAssessments: {
            id: string;
            createdAt: Date;
            lead: {
                id: string;
                name: string;
                company: string;
            } | null;
            deal: {
                id: string;
                name: string;
                stage: string;
            } | null;
            leadScore: number | null;
            priorityTier: string | null;
            closeReadinessScore: number | null;
            recommendedNextAction: string | null;
            summary: string | null;
            assessmentType: string;
        }[];
    }>;
    getLeadWorkspace(tenantId: string, leadId: string): Promise<{
        lead: {
            proposals: {
                createdAt: Date;
                title: string;
                status: string;
            }[];
            notes: {
                id: string;
                createdAt: Date;
                tenantId: string;
                content: string;
                dealId: string | null;
                leadId: string | null;
            }[];
        } & {
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            email: string | null;
            tenantId: string;
            status: string;
            company: string;
        };
        discovery: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            notes: string | null;
            tenantId: string;
            dealId: string | null;
            leadId: string | null;
            guardCount: number | null;
            objections: string[];
            propertyType: string | null;
            buyerRole: string | null;
            currentProvider: string | null;
            serviceHours: string | null;
            painPoints: string[];
            riskConcerns: string[];
            decisionTimeline: string | null;
            budgetSensitivity: string | null;
            createdBy: string | null;
        } | null;
        assessment: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            tenantId: string;
            dealId: string | null;
            leadId: string | null;
            leadScore: number | null;
            priorityTier: string | null;
            closeReadinessScore: number | null;
            discoveryQualityScore: number | null;
            riskProfile: string | null;
            proposalAngle: string | null;
            recommendedNextAction: string | null;
            missingQuestions: string[];
            objectionRisks: string[];
            summary: string | null;
            discoverySessionId: string | null;
            assessmentType: string;
            generatedOutput: Prisma.JsonValue | null;
            aiGenerationId: string | null;
            createdBy: string | null;
        } | null;
        objectionPatterns: ObjectionPattern[];
        marketSignalProfile: MarketSignalProfile;
        valueJustification: ValueJustification;
    }>;
    getDealWorkspace(tenantId: string, dealId: string): Promise<{
        deal: {
            proposals: {
                createdAt: Date;
                title: string;
                status: string;
            }[];
            activities: {
                id: string;
                createdAt: Date;
                status: string;
                subject: string;
                type: string;
                dueDate: Date | null;
            }[];
            notes: {
                id: string;
                createdAt: Date;
                tenantId: string;
                content: string;
                dealId: string | null;
                leadId: string | null;
            }[];
            client: {
                id: string;
                name: string;
                companyName: string | null;
            } | null;
            lead: {
                proposals: {
                    createdAt: Date;
                    title: string;
                    status: string;
                }[];
                notes: {
                    id: string;
                    createdAt: Date;
                    tenantId: string;
                    content: string;
                    dealId: string | null;
                    leadId: string | null;
                }[];
            } & {
                id: string;
                name: string;
                createdAt: Date;
                updatedAt: Date;
                email: string | null;
                tenantId: string;
                status: string;
                company: string;
            };
        } & {
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            tenantId: string;
            clientId: string | null;
            leadId: string;
            stage: string;
        };
        discovery: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            notes: string | null;
            tenantId: string;
            dealId: string | null;
            leadId: string | null;
            guardCount: number | null;
            objections: string[];
            propertyType: string | null;
            buyerRole: string | null;
            currentProvider: string | null;
            serviceHours: string | null;
            painPoints: string[];
            riskConcerns: string[];
            decisionTimeline: string | null;
            budgetSensitivity: string | null;
            createdBy: string | null;
        } | null;
        assessment: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            tenantId: string;
            dealId: string | null;
            leadId: string | null;
            leadScore: number | null;
            priorityTier: string | null;
            closeReadinessScore: number | null;
            discoveryQualityScore: number | null;
            riskProfile: string | null;
            proposalAngle: string | null;
            recommendedNextAction: string | null;
            missingQuestions: string[];
            objectionRisks: string[];
            summary: string | null;
            discoverySessionId: string | null;
            assessmentType: string;
            generatedOutput: Prisma.JsonValue | null;
            aiGenerationId: string | null;
            createdBy: string | null;
        } | null;
        objectionPatterns: ObjectionPattern[];
        momentum: DealMomentum;
        forecast: DealForecast;
        postCloseFeedback: PostCloseFeedback | null;
        pricingGuardrails: PricingGuardrails;
        marketSignalProfile: MarketSignalProfile;
        valueJustification: ValueJustification;
        followUpSequence: FollowUpSequence;
    }>;
    saveLeadDiscovery(tenantId: string, leadId: string, dto: SaveDiscoveryDto, userId?: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        notes: string | null;
        tenantId: string;
        dealId: string | null;
        leadId: string | null;
        guardCount: number | null;
        objections: string[];
        propertyType: string | null;
        buyerRole: string | null;
        currentProvider: string | null;
        serviceHours: string | null;
        painPoints: string[];
        riskConcerns: string[];
        decisionTimeline: string | null;
        budgetSensitivity: string | null;
        createdBy: string | null;
    }>;
    saveDealDiscovery(tenantId: string, dealId: string, dto: SaveDiscoveryDto, userId?: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        notes: string | null;
        tenantId: string;
        dealId: string | null;
        leadId: string | null;
        guardCount: number | null;
        objections: string[];
        propertyType: string | null;
        buyerRole: string | null;
        currentProvider: string | null;
        serviceHours: string | null;
        painPoints: string[];
        riskConcerns: string[];
        decisionTimeline: string | null;
        budgetSensitivity: string | null;
        createdBy: string | null;
    }>;
    generateLeadDiscoveryGuide(tenantId: string, leadId: string, userId?: string): Promise<{
        guide: AiDiscoveryGuideDraft;
        aiGenerationId: string | null;
        fallbackUsed: boolean;
    }>;
    generateDealDiscoveryGuide(tenantId: string, dealId: string, userId?: string): Promise<{
        guide: AiDiscoveryGuideDraft;
        aiGenerationId: string | null;
        fallbackUsed: boolean;
    }>;
    generateLeadOutreach(tenantId: string, leadId: string, userId?: string): Promise<{
        outreach: AiOutreachDraft;
        aiGenerationId: string | null;
        fallbackUsed: boolean;
    }>;
    generateDealOutreach(tenantId: string, dealId: string, userId?: string): Promise<{
        outreach: AiOutreachDraft;
        aiGenerationId: string | null;
        fallbackUsed: boolean;
    }>;
    analyzeLeadDiscoveryCall(tenantId: string, leadId: string, dto: AnalyzeDiscoveryCallDto, userId?: string): Promise<{
        intelligence: AiDiscoveryCallIntelligenceDraft;
        aiGenerationId: string | null;
        fallbackUsed: boolean;
    }>;
    analyzeDealDiscoveryCall(tenantId: string, dealId: string, dto: AnalyzeDiscoveryCallDto, userId?: string): Promise<{
        intelligence: AiDiscoveryCallIntelligenceDraft;
        aiGenerationId: string | null;
        fallbackUsed: boolean;
    }>;
    coachLeadDiscoveryCall(tenantId: string, leadId: string, dto: CoachDiscoveryCallDto, userId?: string): Promise<{
        coach: AiDiscoveryLiveCoachDraft;
        aiGenerationId: string | null;
        fallbackUsed: boolean;
    }>;
    coachDealDiscoveryCall(tenantId: string, dealId: string, dto: CoachDiscoveryCallDto, userId?: string): Promise<{
        coach: AiDiscoveryLiveCoachDraft;
        aiGenerationId: string | null;
        fallbackUsed: boolean;
    }>;
    scoreLead(tenantId: string, leadId: string, userId?: string): Promise<{
        assessment: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            tenantId: string;
            dealId: string | null;
            leadId: string | null;
            leadScore: number | null;
            priorityTier: string | null;
            closeReadinessScore: number | null;
            discoveryQualityScore: number | null;
            riskProfile: string | null;
            proposalAngle: string | null;
            recommendedNextAction: string | null;
            missingQuestions: string[];
            objectionRisks: string[];
            summary: string | null;
            discoverySessionId: string | null;
            assessmentType: string;
            generatedOutput: Prisma.JsonValue | null;
            aiGenerationId: string | null;
            createdBy: string | null;
        };
        aiGenerationId: string | null;
        fallbackUsed: boolean;
    }>;
    scoreDeal(tenantId: string, dealId: string, userId?: string): Promise<{
        assessment: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            tenantId: string;
            dealId: string | null;
            leadId: string | null;
            leadScore: number | null;
            priorityTier: string | null;
            closeReadinessScore: number | null;
            discoveryQualityScore: number | null;
            riskProfile: string | null;
            proposalAngle: string | null;
            recommendedNextAction: string | null;
            missingQuestions: string[];
            objectionRisks: string[];
            summary: string | null;
            discoverySessionId: string | null;
            assessmentType: string;
            generatedOutput: Prisma.JsonValue | null;
            aiGenerationId: string | null;
            createdBy: string | null;
        };
        aiGenerationId: string | null;
        fallbackUsed: boolean;
    }>;
    generateProposalFromDiscovery(tenantId: string, dealId: string, dto: GenerateDiscoveryProposalDto, userId?: string): Promise<{
        proposal: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            tenantId: string;
            clientId: string | null;
            content: string;
            title: string;
            status: string;
            dealId: string | null;
            leadId: string | null;
        };
        pricingGuardrails: PricingGuardrails;
        valueJustification: ValueJustification;
        followUpSequence: FollowUpSequence;
        aiGenerationId: string | null;
        fallbackUsed: boolean;
    }>;
    createDealFollowUp(tenantId: string, dealId: string, dto: CreateFollowUpTaskDto, userId?: string): Promise<{
        id: string;
        createdAt: Date;
        tenantId: string;
        status: string;
        dealId: string | null;
        description: string | null;
        subject: string;
        type: string;
        dueDate: Date | null;
    }>;
    createDealFollowUpSequence(tenantId: string, dealId: string, userId?: string): Promise<{
        sequence: FollowUpSequence;
        createdActivities: ActivitySnapshot[];
        skippedDuplicateCount: number;
    }>;
    private generateDiscoveryGuide;
    private generateOutreachPlan;
    private analyzeDiscoveryCall;
    private coachDiscoveryCall;
    private createAssessment;
    private getLeadOrThrow;
    private getDealOrThrow;
    private salesCoachSummary;
    private salesCoachHeadline;
    private latestDiscovery;
    private latestAssessment;
    private assessmentHistory;
    private discoveryData;
    private contextText;
    private entityObjectionPatterns;
    private buildObjectionPatterns;
    private objectionDefinition;
    private objectionSeverity;
    private dealOutcome;
    private objectionOutcomeSignal;
    private dealForecast;
    private readinessTrend;
    private forecastStatus;
    private forecastLabel;
    private forecastAction;
    private dealMomentum;
    private momentumAction;
    private postCloseOperationsForClient;
    private buildPostCloseOperationContexts;
    private emptyPostCloseOperations;
    private postCloseFeedback;
    private postCloseStatus;
    private postCloseAction;
    private pricingGuardrails;
    private pricingGuardrailStatus;
    private pricingFloorGuidance;
    private pricingProposalInstruction;
    private isClosedWonStage;
    private isClosedLostStage;
    private marketSignalProfile;
    private marketSegment;
    private existingSecurityLikelihood;
    private renewalTimingSignal;
    private decisionAuthoritySignal;
    private marketSignalAction;
    private followUpSequence;
    private valueJustification;
    private valueJustificationStatus;
    private valueRecommendedAction;
    private valueHypothesis;
    private valueCostOfInaction;
    private valueDiscoveryGaps;
    private valueScopeComplexity;
    private estimatedMonthlyGuardHours;
    private estimatedWeeklyServiceHours;
    private valueJustificationContext;
    private ruleAssessment;
    private mergeAssessmentDefaults;
    private assessmentDraftFromRecord;
    private missingQuestions;
    private ruleDiscoveryGuide;
    private ruleOutreachPlan;
    private ruleDiscoveryLiveCoach;
    private ruleDiscoveryCallIntelligence;
    private ruleProposal;
    private timelineSignal;
    private budgetPenalty;
    private priorityTier;
    private clamp;
    private daysBetween;
    private daysAgo;
    private cleanString;
    private cleanList;
    private displayList;
    private callSnippets;
    private average;
    private tomorrow;
    private dateAfter;
}
