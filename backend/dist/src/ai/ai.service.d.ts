import { ConfigService } from '@nestjs/config';
import { GenerateProposalDto } from './dto/generate-proposal.dto';
import { GenerateRfpDto } from './dto/generate-rfp.dto';
import { GenerateEvaluationDto } from './dto/generate-evaluation.dto';
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
export interface AiEvaluationReportDraft {
    summary: string;
    recommendedVendor: string | null;
    overallAnalysis: string;
    fullReportMarkdown: string;
}
export declare const SECURITY_RFP_CATEGORIES: readonly ["services", "staffing", "shifts", "site", "patrol", "access_control", "reporting", "technology", "compliance", "licensing", "insurance", "contract", "pricing", "submission", "special", "other"];
export type SecurityRfpCategory = (typeof SECURITY_RFP_CATEGORIES)[number];
export declare const SECURITY_RFP_IMPORTANCE: readonly ["mandatory", "preferred", "informational"];
export type SecurityRfpImportance = (typeof SECURITY_RFP_IMPORTANCE)[number];
export interface SecurityRfpRequirement {
    requirement: string;
    category: SecurityRfpCategory;
    sourceContext: string | null;
    importance: SecurityRfpImportance;
    extractedValue: string | null;
    confidence: number;
}
export interface SecurityRfpAnalysisDraft {
    summary: string;
    requirements: SecurityRfpRequirement[];
    missingInformation: string[];
    fallbackUsed: boolean;
}
export interface SecurityRfpStructuredInput {
    title: string;
    clientName: string;
    companyName?: string | null;
    industry?: string | null;
    securityTypes: string[];
    numberOfLocations?: number | null;
    address?: string | null;
    operatingHours?: string | null;
    guardsRequired?: number | null;
    startDate?: string | null;
    endDate?: string | null;
    dueDate?: string | null;
    estimatedBudget?: number | null;
    pricingModel?: string | null;
    requiredPricingItems: string[];
    paymentTerms?: string | null;
    additionalRequirements?: string | null;
}
export interface ProspectCompanySummary {
    name: string;
    industry?: string;
    website?: string;
    city?: string;
    state?: string;
    country?: string;
    employeeCount?: number;
    revenueRange?: string;
    description?: string;
}
export interface ProspectCompanyPersona {
    name: string;
    title?: string;
    description?: string;
}
export interface ProspectCompanyObjection {
    objection: string;
    response: string;
}
export interface ProspectCompanyInsight {
    companyName: string;
    domain?: string;
    website?: string;
    businessSummary?: string;
    businessObjective?: string;
    valueProps: string[];
    salesAngles: string[];
    keyPersonas: ProspectCompanyPersona[];
    potentialObjections: ProspectCompanyObjection[];
    meetingNoteExample?: string;
    contactOverview?: string;
    readinessLevel?: string;
    documentUrl?: string;
}
export declare class AiService {
    private configService;
    private readonly logger;
    private readonly fallbackEnabled;
    private readonly modelName;
    private readonly timeoutMs;
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
    private withTimeout;
    private generateText;
    generateSalesAssessment(context: string): Promise<AiSalesAssessmentDraft>;
    generateDiscoveryGuide(context: string): Promise<AiDiscoveryGuideDraft>;
    generateOutreachPlan(context: string): Promise<AiOutreachDraft>;
    generateDiscoveryCallIntelligence(context: string, transcript: string): Promise<AiDiscoveryCallIntelligenceDraft>;
    generateDiscoveryLiveCoach(context: string, transcript: string): Promise<AiDiscoveryLiveCoachDraft>;
    generateDiscoveryProposal(context: string): Promise<string>;
    generateProposalDraft(dto: GenerateProposalDto): Promise<AiProposalDraftResponse>;
    generateRfp(dto: GenerateRfpDto): Promise<string>;
    generateEvaluationReport(dto: GenerateEvaluationDto): Promise<AiEvaluationReportDraft>;
    private sanitizeRecommendedVendorSection;
    private fallbackEvaluationReport;
    analyzeSecurityRfp(input: {
        sourceText: string;
        structured: SecurityRfpStructuredInput;
    }): Promise<SecurityRfpAnalysisDraft>;
    generateProposalFromRfp(input: {
        structured: SecurityRfpStructuredInput;
        analysis: SecurityRfpAnalysisDraft;
        capabilities: string;
    }): Promise<string>;
    private securityRfpStructuredBlock;
    private normalizeSecurityRfpAnalysis;
    private fallbackSecurityRfpAnalysis;
    private fallbackRfpProposal;
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
    private fallbackPricingSection;
    private fallbackRfp;
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
    generateProspectCompanyInsight(company: ProspectCompanySummary, searchPrompt?: string | null, promptTemplate?: string | null): Promise<ProspectCompanyInsight>;
    private fallbackProspectCompanyInsight;
}
