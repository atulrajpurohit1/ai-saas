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
            };
            marketSignalProfile: import("./sales-accelerator.service").MarketSignalProfile;
            id: string;
            name: string;
            company: string;
            status: string;
            createdAt: Date;
            discoverySessions: {
                id: string;
                createdAt: Date;
                notes: string | null;
                propertyType: string | null;
                buyerRole: string | null;
                currentProvider: string | null;
                guardCount: number | null;
                serviceHours: string | null;
                painPoints: string[];
                riskConcerns: string[];
                decisionTimeline: string | null;
                budgetSensitivity: string | null;
                objections: string[];
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
            momentum: import("./sales-accelerator.service").DealMomentum;
            forecast: import("./sales-accelerator.service").DealForecast;
            marketSignalProfile: import("./sales-accelerator.service").MarketSignalProfile;
            lead: {
                id: string;
                name: string;
                company: string;
            };
            id: string;
            name: string;
            createdAt: Date;
            discoverySessions: {
                id: string;
                createdAt: Date;
                notes: string | null;
                propertyType: string | null;
                buyerRole: string | null;
                currentProvider: string | null;
                guardCount: number | null;
                serviceHours: string | null;
                painPoints: string[];
                riskConcerns: string[];
                decisionTimeline: string | null;
                budgetSensitivity: string | null;
                objections: string[];
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
            stage: string;
            activities: {
                id: string;
                status: string;
                createdAt: Date;
                type: string;
                subject: string;
                dueDate: Date | null;
            }[];
            client: {
                id: string;
                name: string;
                companyName: string | null;
            } | null;
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
            momentum: import("./sales-accelerator.service").DealMomentum;
            forecast: import("./sales-accelerator.service").DealForecast;
            marketSignalProfile: import("./sales-accelerator.service").MarketSignalProfile;
            lead: {
                id: string;
                name: string;
                company: string;
            };
            id: string;
            name: string;
            createdAt: Date;
            discoverySessions: {
                id: string;
                createdAt: Date;
                notes: string | null;
                propertyType: string | null;
                buyerRole: string | null;
                currentProvider: string | null;
                guardCount: number | null;
                serviceHours: string | null;
                painPoints: string[];
                riskConcerns: string[];
                decisionTimeline: string | null;
                budgetSensitivity: string | null;
                objections: string[];
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
            stage: string;
            activities: {
                id: string;
                status: string;
                createdAt: Date;
                type: string;
                subject: string;
                dueDate: Date | null;
            }[];
            client: {
                id: string;
                name: string;
                companyName: string | null;
            } | null;
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
            momentum: import("./sales-accelerator.service").DealMomentum;
            forecast: import("./sales-accelerator.service").DealForecast;
            marketSignalProfile: import("./sales-accelerator.service").MarketSignalProfile;
            lead: {
                id: string;
                name: string;
                company: string;
            };
            id: string;
            name: string;
            createdAt: Date;
            discoverySessions: {
                id: string;
                createdAt: Date;
                notes: string | null;
                propertyType: string | null;
                buyerRole: string | null;
                currentProvider: string | null;
                guardCount: number | null;
                serviceHours: string | null;
                painPoints: string[];
                riskConcerns: string[];
                decisionTimeline: string | null;
                budgetSensitivity: string | null;
                objections: string[];
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
            stage: string;
            activities: {
                id: string;
                status: string;
                createdAt: Date;
                type: string;
                subject: string;
                dueDate: Date | null;
            }[];
            client: {
                id: string;
                name: string;
                companyName: string | null;
            } | null;
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
                summary: string | null;
            };
            momentum: import("./sales-accelerator.service").DealMomentum;
            forecast: import("./sales-accelerator.service").DealForecast;
            marketSignalProfile: import("./sales-accelerator.service").MarketSignalProfile;
            lead: {
                id: string;
                name: string;
                company: string;
            };
            id: string;
            name: string;
            createdAt: Date;
            discoverySessions: {
                id: string;
                createdAt: Date;
                notes: string | null;
                propertyType: string | null;
                buyerRole: string | null;
                currentProvider: string | null;
                guardCount: number | null;
                serviceHours: string | null;
                painPoints: string[];
                riskConcerns: string[];
                decisionTimeline: string | null;
                budgetSensitivity: string | null;
                objections: string[];
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
            stage: string;
            activities: {
                id: string;
                status: string;
                createdAt: Date;
                type: string;
                subject: string;
                dueDate: Date | null;
            }[];
            client: {
                id: string;
                name: string;
                companyName: string | null;
            } | null;
        }[];
        objectionPatterns: import("./sales-accelerator.service").ObjectionPattern[];
        missingDiscoveryLeads: {
            id: string;
            name: string;
            company: string;
            status: string;
            createdAt: Date;
            discoverySessions: {
                id: string;
                createdAt: Date;
                notes: string | null;
                propertyType: string | null;
                buyerRole: string | null;
                currentProvider: string | null;
                guardCount: number | null;
                serviceHours: string | null;
                painPoints: string[];
                riskConcerns: string[];
                decisionTimeline: string | null;
                budgetSensitivity: string | null;
                objections: string[];
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
            momentum: import("./sales-accelerator.service").DealMomentum;
            forecast: import("./sales-accelerator.service").DealForecast;
            marketSignalProfile: import("./sales-accelerator.service").MarketSignalProfile;
            lead: {
                id: string;
                name: string;
                company: string;
            };
            id: string;
            name: string;
            createdAt: Date;
            discoverySessions: {
                id: string;
                createdAt: Date;
                notes: string | null;
                propertyType: string | null;
                buyerRole: string | null;
                currentProvider: string | null;
                guardCount: number | null;
                serviceHours: string | null;
                painPoints: string[];
                riskConcerns: string[];
                decisionTimeline: string | null;
                budgetSensitivity: string | null;
                objections: string[];
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
            stage: string;
            activities: {
                id: string;
                status: string;
                createdAt: Date;
                type: string;
                subject: string;
                dueDate: Date | null;
            }[];
            client: {
                id: string;
                name: string;
                companyName: string | null;
            } | null;
        }[];
        recentAssessments: {
            lead: {
                id: string;
                name: string;
                company: string;
            } | null;
            id: string;
            createdAt: Date;
            deal: {
                id: string;
                name: string;
                stage: string;
            } | null;
            assessmentType: string;
            leadScore: number | null;
            priorityTier: string | null;
            closeReadinessScore: number | null;
            recommendedNextAction: string | null;
            summary: string | null;
        }[];
    }>;
    getLeadWorkspace(leadId: string, user: ActiveUser): Promise<{
        lead: {
            proposals: {
                status: string;
                createdAt: Date;
                title: string;
            }[];
            notes: {
                id: string;
                tenantId: string;
                createdAt: Date;
                leadId: string | null;
                dealId: string | null;
                content: string;
            }[];
        } & {
            id: string;
            name: string;
            company: string;
            status: string;
            tenantId: string;
            createdAt: Date;
            updatedAt: Date;
            email: string | null;
        };
        discovery: {
            id: string;
            tenantId: string;
            createdAt: Date;
            updatedAt: Date;
            notes: string | null;
            leadId: string | null;
            dealId: string | null;
            propertyType: string | null;
            buyerRole: string | null;
            currentProvider: string | null;
            guardCount: number | null;
            serviceHours: string | null;
            painPoints: string[];
            riskConcerns: string[];
            decisionTimeline: string | null;
            budgetSensitivity: string | null;
            objections: string[];
            createdBy: string | null;
        } | null;
        assessment: {
            id: string;
            tenantId: string;
            createdAt: Date;
            updatedAt: Date;
            leadId: string | null;
            dealId: string | null;
            createdBy: string | null;
            discoverySessionId: string | null;
            assessmentType: string;
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
            generatedOutput: import("@prisma/client/runtime/library").JsonValue | null;
            aiGenerationId: string | null;
        } | null;
        objectionPatterns: import("./sales-accelerator.service").ObjectionPattern[];
        marketSignalProfile: import("./sales-accelerator.service").MarketSignalProfile;
    }>;
    getDealWorkspace(dealId: string, user: ActiveUser): Promise<{
        deal: {
            lead: {
                proposals: {
                    status: string;
                    createdAt: Date;
                    title: string;
                }[];
                notes: {
                    id: string;
                    tenantId: string;
                    createdAt: Date;
                    leadId: string | null;
                    dealId: string | null;
                    content: string;
                }[];
            } & {
                id: string;
                name: string;
                company: string;
                status: string;
                tenantId: string;
                createdAt: Date;
                updatedAt: Date;
                email: string | null;
            };
            proposals: {
                status: string;
                createdAt: Date;
                title: string;
            }[];
            notes: {
                id: string;
                tenantId: string;
                createdAt: Date;
                leadId: string | null;
                dealId: string | null;
                content: string;
            }[];
            activities: {
                id: string;
                status: string;
                createdAt: Date;
                type: string;
                subject: string;
                dueDate: Date | null;
            }[];
            client: {
                id: string;
                name: string;
                companyName: string | null;
            } | null;
        } & {
            id: string;
            name: string;
            tenantId: string;
            createdAt: Date;
            updatedAt: Date;
            leadId: string;
            stage: string;
            clientId: string | null;
        };
        discovery: {
            id: string;
            tenantId: string;
            createdAt: Date;
            updatedAt: Date;
            notes: string | null;
            leadId: string | null;
            dealId: string | null;
            propertyType: string | null;
            buyerRole: string | null;
            currentProvider: string | null;
            guardCount: number | null;
            serviceHours: string | null;
            painPoints: string[];
            riskConcerns: string[];
            decisionTimeline: string | null;
            budgetSensitivity: string | null;
            objections: string[];
            createdBy: string | null;
        } | null;
        assessment: {
            id: string;
            tenantId: string;
            createdAt: Date;
            updatedAt: Date;
            leadId: string | null;
            dealId: string | null;
            createdBy: string | null;
            discoverySessionId: string | null;
            assessmentType: string;
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
            generatedOutput: import("@prisma/client/runtime/library").JsonValue | null;
            aiGenerationId: string | null;
        } | null;
        objectionPatterns: import("./sales-accelerator.service").ObjectionPattern[];
        momentum: import("./sales-accelerator.service").DealMomentum;
        forecast: import("./sales-accelerator.service").DealForecast;
        postCloseFeedback: import("./sales-accelerator.service").PostCloseFeedback | null;
        pricingGuardrails: import("./sales-accelerator.service").PricingGuardrails;
        marketSignalProfile: import("./sales-accelerator.service").MarketSignalProfile;
    }>;
    saveLeadDiscovery(leadId: string, dto: SaveDiscoveryDto, user: ActiveUser): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        updatedAt: Date;
        notes: string | null;
        leadId: string | null;
        dealId: string | null;
        propertyType: string | null;
        buyerRole: string | null;
        currentProvider: string | null;
        guardCount: number | null;
        serviceHours: string | null;
        painPoints: string[];
        riskConcerns: string[];
        decisionTimeline: string | null;
        budgetSensitivity: string | null;
        objections: string[];
        createdBy: string | null;
    }>;
    saveDealDiscovery(dealId: string, dto: SaveDiscoveryDto, user: ActiveUser): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        updatedAt: Date;
        notes: string | null;
        leadId: string | null;
        dealId: string | null;
        propertyType: string | null;
        buyerRole: string | null;
        currentProvider: string | null;
        guardCount: number | null;
        serviceHours: string | null;
        painPoints: string[];
        riskConcerns: string[];
        decisionTimeline: string | null;
        budgetSensitivity: string | null;
        objections: string[];
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
            tenantId: string;
            createdAt: Date;
            updatedAt: Date;
            leadId: string | null;
            dealId: string | null;
            createdBy: string | null;
            discoverySessionId: string | null;
            assessmentType: string;
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
            generatedOutput: import("@prisma/client/runtime/library").JsonValue | null;
            aiGenerationId: string | null;
        };
        aiGenerationId: string | null;
        fallbackUsed: boolean;
    }>;
    scoreDeal(dealId: string, user: ActiveUser): Promise<{
        assessment: {
            id: string;
            tenantId: string;
            createdAt: Date;
            updatedAt: Date;
            leadId: string | null;
            dealId: string | null;
            createdBy: string | null;
            discoverySessionId: string | null;
            assessmentType: string;
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
            generatedOutput: import("@prisma/client/runtime/library").JsonValue | null;
            aiGenerationId: string | null;
        };
        aiGenerationId: string | null;
        fallbackUsed: boolean;
    }>;
    generateProposalFromDiscovery(dealId: string, dto: GenerateDiscoveryProposalDto, user: ActiveUser): Promise<{
        proposal: {
            id: string;
            status: string;
            tenantId: string;
            createdAt: Date;
            updatedAt: Date;
            leadId: string | null;
            dealId: string | null;
            clientId: string | null;
            title: string;
            content: string;
        };
        pricingGuardrails: import("./sales-accelerator.service").PricingGuardrails;
        aiGenerationId: string | null;
        fallbackUsed: boolean;
    }>;
    createDealFollowUp(dealId: string, dto: CreateFollowUpTaskDto, user: ActiveUser): Promise<{
        id: string;
        status: string;
        tenantId: string;
        createdAt: Date;
        dealId: string | null;
        type: string;
        subject: string;
        description: string | null;
        dueDate: Date | null;
    }>;
}
