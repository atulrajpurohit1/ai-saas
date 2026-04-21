import { ConfigService } from '@nestjs/config';
import { GenerateProposalDto } from './dto/generate-proposal.dto';
import { Lead } from '@prisma/client';
export interface AiProposalDraftResponse {
    draft: string | null;
}
export declare class AiService {
    private configService;
    private genAI;
    private readonly isPlaceholderKey;
    constructor(configService: ConfigService);
    private checkApiKey;
    generateProposalDraft(dto: GenerateProposalDto): Promise<AiProposalDraftResponse>;
    generateForLead(lead: Lead): Promise<string>;
    generateEmailDraft(subject: string, context: string): Promise<string>;
    summarizeNotes(notes: string[]): Promise<string>;
    extractLeadFromText(text: string): Promise<{
        name: string;
        company: string;
        email: string;
    }>;
}
