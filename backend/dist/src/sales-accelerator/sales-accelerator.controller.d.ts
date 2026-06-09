import { ActiveUser } from '../auth/interfaces/active-user.interface';
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
            createdBy: string | null;
            propertyType: string | null;
            buyerRole: string | null;
            currentProvider: string | null;
            serviceHours: string | null;
            painPoints: string[];
            riskConcerns: string[];
            decisionTimeline: string | null;
            budgetSensitivity: string | null;
            objections: string[];
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
    }>;
    getDealWorkspace(dealId: string, user: ActiveUser): Promise<{
        deal: {
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
            createdBy: string | null;
            propertyType: string | null;
            buyerRole: string | null;
            currentProvider: string | null;
            serviceHours: string | null;
            painPoints: string[];
            riskConcerns: string[];
            decisionTimeline: string | null;
            budgetSensitivity: string | null;
            objections: string[];
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
        createdBy: string | null;
        propertyType: string | null;
        buyerRole: string | null;
        currentProvider: string | null;
        serviceHours: string | null;
        painPoints: string[];
        riskConcerns: string[];
        decisionTimeline: string | null;
        budgetSensitivity: string | null;
        objections: string[];
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
        createdBy: string | null;
        propertyType: string | null;
        buyerRole: string | null;
        currentProvider: string | null;
        serviceHours: string | null;
        painPoints: string[];
        riskConcerns: string[];
        decisionTimeline: string | null;
        budgetSensitivity: string | null;
        objections: string[];
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
        aiGenerationId: string | null;
        fallbackUsed: boolean;
    }>;
}
