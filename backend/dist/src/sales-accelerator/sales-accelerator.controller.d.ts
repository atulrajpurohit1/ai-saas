import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { AnalyzeDiscoveryCallDto } from './dto/analyze-discovery-call.dto';
import { CoachDiscoveryCallDto } from './dto/coach-discovery-call.dto';
import { CreateFollowUpTaskDto } from './dto/create-follow-up-task.dto';
import { GenerateDiscoveryProposalDto } from './dto/generate-discovery-proposal.dto';
import { SaveDiscoveryDto } from './dto/save-discovery.dto';
import { SalesAcceleratorService } from './sales-accelerator.service';
export declare class SalesAcceleratorController {
    private readonly salesAcceleratorService;
    constructor(salesAcceleratorService: SalesAcceleratorService);
    getDashboard(user: ActiveUser): Promise<{
        generatedAt: string;
        salesCoachSummary: import("./sales-accelerator.service").SalesCoachSummary;
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
            marketSignalProfile: import("./sales-accelerator.service").MarketSignalProfile;
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
            momentum: import("./sales-accelerator.service").DealMomentum;
            forecast: import("./sales-accelerator.service").DealForecast;
            marketSignalProfile: import("./sales-accelerator.service").MarketSignalProfile;
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
            momentum: import("./sales-accelerator.service").DealMomentum;
            forecast: import("./sales-accelerator.service").DealForecast;
            marketSignalProfile: import("./sales-accelerator.service").MarketSignalProfile;
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
            momentum: import("./sales-accelerator.service").DealMomentum;
            forecast: import("./sales-accelerator.service").DealForecast;
            marketSignalProfile: import("./sales-accelerator.service").MarketSignalProfile;
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
            postCloseFeedback: import("./sales-accelerator.service").PostCloseFeedback;
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
            momentum: import("./sales-accelerator.service").DealMomentum;
            forecast: import("./sales-accelerator.service").DealForecast;
            marketSignalProfile: import("./sales-accelerator.service").MarketSignalProfile;
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
        objectionPatterns: import("./sales-accelerator.service").ObjectionPattern[];
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
            momentum: import("./sales-accelerator.service").DealMomentum;
            forecast: import("./sales-accelerator.service").DealForecast;
            marketSignalProfile: import("./sales-accelerator.service").MarketSignalProfile;
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
    getLeadWorkspace(leadId: string, user: ActiveUser): Promise<{
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
            generatedOutput: import("@prisma/client/runtime/library").JsonValue | null;
            aiGenerationId: string | null;
            createdBy: string | null;
        } | null;
        objectionPatterns: import("./sales-accelerator.service").ObjectionPattern[];
        marketSignalProfile: import("./sales-accelerator.service").MarketSignalProfile;
        valueJustification: import("./sales-accelerator.service").ValueJustification;
    }>;
    getDealWorkspace(dealId: string, user: ActiveUser): Promise<{
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
            generatedOutput: import("@prisma/client/runtime/library").JsonValue | null;
            aiGenerationId: string | null;
            createdBy: string | null;
        } | null;
        objectionPatterns: import("./sales-accelerator.service").ObjectionPattern[];
        momentum: import("./sales-accelerator.service").DealMomentum;
        forecast: import("./sales-accelerator.service").DealForecast;
        postCloseFeedback: import("./sales-accelerator.service").PostCloseFeedback | null;
        pricingGuardrails: import("./sales-accelerator.service").PricingGuardrails;
        marketSignalProfile: import("./sales-accelerator.service").MarketSignalProfile;
        valueJustification: import("./sales-accelerator.service").ValueJustification;
        followUpSequence: import("./sales-accelerator.service").FollowUpSequence;
    }>;
    saveLeadDiscovery(leadId: string, dto: SaveDiscoveryDto, user: ActiveUser): Promise<{
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
    saveDealDiscovery(dealId: string, dto: SaveDiscoveryDto, user: ActiveUser): Promise<{
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
    generateLeadDiscoveryGuide(leadId: string, user: ActiveUser): Promise<{
        guide: import("../ai/ai.service").AiDiscoveryGuideDraft;
        aiGenerationId: string | null;
        fallbackUsed: boolean;
    }>;
    generateDealDiscoveryGuide(dealId: string, user: ActiveUser): Promise<{
        guide: import("../ai/ai.service").AiDiscoveryGuideDraft;
        aiGenerationId: string | null;
        fallbackUsed: boolean;
    }>;
    analyzeLeadDiscoveryCall(leadId: string, dto: AnalyzeDiscoveryCallDto, user: ActiveUser): Promise<{
        intelligence: import("../ai/ai.service").AiDiscoveryCallIntelligenceDraft;
        aiGenerationId: string | null;
        fallbackUsed: boolean;
    }>;
    analyzeDealDiscoveryCall(dealId: string, dto: AnalyzeDiscoveryCallDto, user: ActiveUser): Promise<{
        intelligence: import("../ai/ai.service").AiDiscoveryCallIntelligenceDraft;
        aiGenerationId: string | null;
        fallbackUsed: boolean;
    }>;
    coachLeadDiscoveryCall(leadId: string, dto: CoachDiscoveryCallDto, user: ActiveUser): Promise<{
        coach: import("../ai/ai.service").AiDiscoveryLiveCoachDraft;
        aiGenerationId: string | null;
        fallbackUsed: boolean;
    }>;
    coachDealDiscoveryCall(dealId: string, dto: CoachDiscoveryCallDto, user: ActiveUser): Promise<{
        coach: import("../ai/ai.service").AiDiscoveryLiveCoachDraft;
        aiGenerationId: string | null;
        fallbackUsed: boolean;
    }>;
    generateLeadOutreach(leadId: string, user: ActiveUser): Promise<{
        outreach: import("../ai/ai.service").AiOutreachDraft;
        aiGenerationId: string | null;
        fallbackUsed: boolean;
    }>;
    generateDealOutreach(dealId: string, user: ActiveUser): Promise<{
        outreach: import("../ai/ai.service").AiOutreachDraft;
        aiGenerationId: string | null;
        fallbackUsed: boolean;
    }>;
    scoreLead(leadId: string, user: ActiveUser): Promise<{
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
            generatedOutput: import("@prisma/client/runtime/library").JsonValue | null;
            aiGenerationId: string | null;
            createdBy: string | null;
        };
        aiGenerationId: string | null;
        fallbackUsed: boolean;
    }>;
    scoreDeal(dealId: string, user: ActiveUser): Promise<{
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
            generatedOutput: import("@prisma/client/runtime/library").JsonValue | null;
            aiGenerationId: string | null;
            createdBy: string | null;
        };
        aiGenerationId: string | null;
        fallbackUsed: boolean;
    }>;
    generateProposalFromDiscovery(dealId: string, dto: GenerateDiscoveryProposalDto, user: ActiveUser): Promise<{
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
        pricingGuardrails: import("./sales-accelerator.service").PricingGuardrails;
        valueJustification: import("./sales-accelerator.service").ValueJustification;
        followUpSequence: import("./sales-accelerator.service").FollowUpSequence;
        aiGenerationId: string | null;
        fallbackUsed: boolean;
    }>;
    createDealFollowUp(dealId: string, dto: CreateFollowUpTaskDto, user: ActiveUser): Promise<{
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
    createDealFollowUpSequence(dealId: string, user: ActiveUser): Promise<{
        sequence: import("./sales-accelerator.service").FollowUpSequence;
        createdActivities: import("./sales-accelerator.service").ActivitySnapshot[];
        skippedDuplicateCount: number;
    }>;
}
