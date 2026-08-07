import { PrismaService } from '../prisma/prisma.service';
import { AiApprovalStatus, AiSafetyResult, PromptUsageDefinition, ResolvedPromptVersion } from './ai-governance.types';
export declare const PROMPT_USAGE_REGISTRY: PromptUsageDefinition[];
export declare class AiGovernanceService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    resolvePromptVersion(input: {
        tenantId: string;
        moduleName: string;
        promptKey?: string;
        fallbackVersion?: string;
    }): Promise<ResolvedPromptVersion>;
    evaluateSafety(input: {
        generatedOutput: unknown;
        inputSource?: unknown;
        clientVisible?: boolean;
    }): AiSafetyResult;
    approvalStatusFor(input: {
        clientVisible?: boolean;
        safetyStatus: AiSafetyResult['status'];
    }): AiApprovalStatus;
    private defaultPromptKeyFor;
    private defaultVersionFor;
    private stringifyTextValues;
    private inputReferencesMultipleClients;
}
