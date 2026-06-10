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
export interface AiOutreachDraft {
    callOpener: string;
    talkingPoints: string[];
    voicemailScript: string;
    emailSubject: string;
    emailBody: string;
    gatekeeperStrategy: string;
    bestCallWindow: string;
    followUpPlan: string[];
}
export interface AiCallDiscoveryDraft {
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
    notes: string | null;
}
export interface AiDiscoveryCallIntelligenceDraft {
    summary: string;
    discovery: AiCallDiscoveryDraft;
    buyingSignals: string[];
    riskSignals: string[];
    unansweredQuestions: string[];
    objections: string[];
    decisionMakers: string[];
    recommendedNextAction: string;
    confidenceScore: number;
}
export interface AiDiscoveryLiveCoachDraft {
    completenessScore: number;
    nextBestQuestion: string;
    missedQuestions: string[];
    livePrompts: string[];
    qualificationGaps: string[];
    riskPrompts: string[];
    followUpAngles: string[];
    coachingNote: string;
    confidenceScore: number;
    shouldPauseProposal: boolean;
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
    private normalizeOptionalString;
    private normalizeOptionalNumber;
    private normalizeStringArray;
    private generateText;
    generateSalesAssessment(context: string): Promise<AiSalesAssessmentDraft>;
    generateDiscoveryGuide(context: string): Promise<AiDiscoveryGuideDraft>;
    generateOutreachPlan(context: string): Promise<AiOutreachDraft>;
    generateDiscoveryCallIntelligence(context: string, transcript: string): Promise<AiDiscoveryCallIntelligenceDraft>;
    generateDiscoveryLiveCoach(context: string, transcript: string): Promise<AiDiscoveryLiveCoachDraft>;
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
    private fallbackOutreachPlan;
    private fallbackDiscoveryCallIntelligence;
    private fallbackDiscoveryLiveCoach;
    private transcriptSnippets;
    private fallbackDiscoveryProposal;
    extractLeadFromText(text: string): Promise<{
        name: string;
        company: string;
        email: string;
    }>;
}
