import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { AiCopilotService } from './ai-copilot.service';
import { AskCopilotDto } from './dto/ask-copilot.dto';
export declare class AiCopilotController {
    private readonly aiCopilotService;
    constructor(aiCopilotService: AiCopilotService);
    ask(user: ActiveUser, dto: AskCopilotDto): Promise<import("./ai-copilot.types").CopilotAnswer>;
    history(user: ActiveUser, limit?: string): Promise<import("./ai-copilot.types").AiConversationRecord[]>;
    suggestedQuestions(user: ActiveUser): string[];
}
