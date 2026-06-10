import { Prisma } from '@prisma/client';
import { AiDiscoveryCallIntelligenceDraft, AiDiscoveryGuideDraft, AiOutreachDraft, AiService } from '../ai/ai.service';
import { AiMonitoringService } from '../ai-monitoring/ai-monitoring.service';
import { AuditService } from '../audit/audit.service';
import { ActivitiesService } from '../activities/activities.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProposalsService } from '../proposals/proposals.service';
import { AnalyzeDiscoveryCallDto } from './dto/analyze-discovery-call.dto';
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
export interface ObjectionPattern {
    key: string;
    label: string;
    count: number;
    severity: 'high' | 'medium' | 'low';
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
            };
            id: string;
            name: string;
            createdAt: Date;
            discoverySessions: {
                id: string;
                createdAt: Date;
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
                summary: string | null;
            };
            momentum: DealMomentum;
            forecast: DealForecast;
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
                summary: string | null;
            };
            momentum: DealMomentum;
            forecast: DealForecast;
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
                summary: string | null;
            };
            momentum: DealMomentum;
            forecast: DealForecast;
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
                summary: string | null;
            };
            momentum: DealMomentum;
            forecast: DealForecast;
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
    private generateDiscoveryGuide;
    private generateOutreachPlan;
    private analyzeDiscoveryCall;
    private createAssessment;
    private getLeadOrThrow;
    private getDealOrThrow;
    private latestDiscovery;
    private latestAssessment;
    private assessmentHistory;
    private discoveryData;
    private contextText;
    private entityObjectionPatterns;
    private buildObjectionPatterns;
    private objectionDefinition;
    private objectionSeverity;
    private dealForecast;
    private readinessTrend;
    private forecastStatus;
    private forecastLabel;
    private forecastAction;
    private dealMomentum;
    private momentumAction;
    private ruleAssessment;
    private mergeAssessmentDefaults;
    private assessmentDraftFromRecord;
    private missingQuestions;
    private ruleDiscoveryGuide;
    private ruleOutreachPlan;
    private ruleDiscoveryCallIntelligence;
    private ruleProposal;
    private timelineSignal;
    private budgetPenalty;
    private priorityTier;
    private clamp;
    private daysBetween;
    private cleanString;
    private cleanList;
    private displayList;
    private callSnippets;
    private average;
    private tomorrow;
}
