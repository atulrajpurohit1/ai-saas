import { ConfigService } from '@nestjs/config';
import { GenerateProposalDto } from './dto/generate-proposal.dto';
import { Lead } from '@prisma/client';
export interface AiProposalDraftResponse {
    draft: string | null;
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
    private getUnavailableMessage;
    private generateText;
    generateProposalDraft(dto: GenerateProposalDto): Promise<AiProposalDraftResponse>;
    generateForLead(lead: Lead & {
        notes?: any[];
        deals?: any[];
    }): Promise<string>;
    generateEmailDraft(subject: string, context: string): Promise<string>;
    summarizeNotes(notes: string[]): Promise<string>;
    generateBusinessInsightRecommendations(context: string): Promise<string[] | null>;
    generateIncidentRiskSummary(context: string): Promise<string | null>;
    explainGuardRecommendation(context: string): Promise<string | null>;
    private fallbackProposalDraft;
    private fallbackLeadProposal;
    private fallbackEmailDraft;
    private fallbackSummarizeNotes;
    extractLeadFromText(text: string): Promise<{
        name: string;
        company: string;
        email: string;
    }>;
}
