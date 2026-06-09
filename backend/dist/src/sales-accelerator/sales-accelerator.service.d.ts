import { Prisma } from '@prisma/client';
import { AiDiscoveryGuideDraft, AiService } from '../ai/ai.service';
import { AiMonitoringService } from '../ai-monitoring/ai-monitoring.service';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProposalsService } from '../proposals/proposals.service';
import { GenerateDiscoveryProposalDto } from './dto/generate-discovery-proposal.dto';
import { SaveDiscoveryDto } from './dto/save-discovery.dto';
export declare class SalesAcceleratorService {
    private readonly prisma;
    private readonly aiService;
    private readonly aiMonitoringService;
    private readonly auditService;
    private readonly proposalsService;
    private readonly logger;
    constructor(prisma: PrismaService, aiService: AiService, aiMonitoringService: AiMonitoringService, auditService: AuditService, proposalsService: ProposalsService);
    getDashboard(tenantId: string): Promise<{
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
            generatedOutput: Prisma.JsonValue | null;
            aiGenerationId: string | null;
            createdBy: string | null;
        } | null;
    }>;
    getDealWorkspace(tenantId: string, dealId: string): Promise<{
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
            generatedOutput: Prisma.JsonValue | null;
            aiGenerationId: string | null;
            createdBy: string | null;
        } | null;
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
    saveDealDiscovery(tenantId: string, dealId: string, dto: SaveDiscoveryDto, userId?: string): Promise<{
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
    private generateDiscoveryGuide;
    private createAssessment;
    private getLeadOrThrow;
    private getDealOrThrow;
    private latestDiscovery;
    private latestAssessment;
    private discoveryData;
    private contextText;
    private ruleAssessment;
    private mergeAssessmentDefaults;
    private assessmentDraftFromRecord;
    private missingQuestions;
    private ruleDiscoveryGuide;
    private ruleProposal;
    private timelineSignal;
    private budgetPenalty;
    private priorityTier;
    private clamp;
    private cleanString;
    private cleanList;
    private displayList;
    private average;
}
