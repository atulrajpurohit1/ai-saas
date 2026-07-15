import { AiService } from '../ai/ai.service';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { AiConversationRecord, CopilotAnswer } from './ai-copilot.types';
import { CopilotQueryService } from './copilot-query.service';
export declare const COPILOT_SUGGESTED_QUESTIONS: readonly ["What are the top risk sites right now?", "What is the revenue forecast?", "Show overdue invoices.", "Where do we have staffing shortages?", "Which contracts or renewals need attention?"];
export declare class AiCopilotService {
    private readonly prisma;
    private readonly aiService;
    private readonly auditService;
    private readonly queryService;
    constructor(prisma: PrismaService, aiService: AiService, auditService: AuditService, queryService: CopilotQueryService);
    ask(input: {
        tenantId: string;
        userId: string;
        userRole: string;
        question: string;
    }): Promise<CopilotAnswer>;
    history(tenantId: string, userId: string, limit?: number): Promise<AiConversationRecord[]>;
    getSuggestedQuestions(role?: string): string[];
    private createConversation;
    private dedupeSources;
    private roundConfidence;
}
