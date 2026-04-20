import { AiService, AiProposalDraftResponse } from './ai.service';
import { GenerateProposalDto } from './dto/generate-proposal.dto';
export declare class AiController {
    private readonly aiService;
    constructor(aiService: AiService);
    generateProposalDraft(dto: GenerateProposalDto): Promise<AiProposalDraftResponse>;
}
