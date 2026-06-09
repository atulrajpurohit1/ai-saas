import { ConfigService } from '@nestjs/config';
import { GenerateProposalDto } from './dto/generate-proposal.dto';
import { Lead } from '@prisma/client';
export interface AiProposalDraftResponse {
    draft: string | null;
}
export interface AiRevenueRecommendationDraft {
    title: string;
    action: string;
    reason: string;
    priority: 'high' | 'medium' | 'low';
}
export interface AiSalesAssessmentDraft {
    leadScore: number;
    priorityTier: 'high' | 'medium' | 'low';
    closeReadinessScore: number;
    discoveryQualityScore: number;
    riskProfile: string;
    proposalAngle: string;
    recommendedNextAction: string;
    missingQuestions: string[];
    objectionRisks: string[];
    summary: string;
}
export interface AiDiscoveryGuideDraft {
    questions: string[];
    talkingPoints: string[];
    followUpAngles: string[];
    qualificationChecklist: string[];
}
export declare class AiService {
    private configService;
    private readonly logger;
    private readonly fallbackEnabled;
    private readonly modelName;
    private genAI;
    private model;
    constructor(configService: ConfigService);
    private isAiAvailable;
    private getFallbackEnabled;
    getModelName(): string;
    private getUnavailableMessage;
    private renderPrompt;
    private parseJsonFromText;
    private clampScore;
    private normalizeStringArray;
    private generateText;
    generateSalesAssessment(context: string): Promise<AiSalesAssessmentDraft>;
    generateDiscoveryGuide(context: string): Promise<AiDiscoveryGuideDraft>;
    generateDiscoveryProposal(context: string): Promise<string>;
    generateProposalDraft(dto: GenerateProposalDto): Promise<AiProposalDraftResponse>;
    generateForLead(lead: Lead & {
        notes?: any[];
        deals?: any[];
    }): Promise<string>;
    generateEmailDraft(subject: string, context: string): Promise<string>;
    summarizeNotes(notes: string[]): Promise<string>;
    generateBusinessInsightRecommendations(context: string, promptTemplate?: string | null): Promise<string[] | null>;
    generateIncidentRiskSummary(context: string, promptTemplate?: string | null): Promise<string | null>;
    generateRevenueIntelligenceSummary(context: string, promptTemplate?: string | null): Promise<string | null>;
    generateRevenueFinancialRecommendations(context: string, promptTemplate?: string | null): Promise<AiRevenueRecommendationDraft[] | null>;
    explainGuardRecommendation(context: string, promptTemplate?: string | null): Promise<string | null>;
    generateCopilotAnswer(context: string): Promise<string | null>;
    private fallbackProposalDraft;
    private fallbackLeadProposal;
    private fallbackEmailDraft;
    private fallbackSummarizeNotes;
    private fallbackSalesAssessment;
    private fallbackDiscoveryGuide;
    private fallbackDiscoveryProposal;
    extractLeadFromText(text: string): Promise<{
        name: string;
        company: string;
        email: string;
    }>;
}
