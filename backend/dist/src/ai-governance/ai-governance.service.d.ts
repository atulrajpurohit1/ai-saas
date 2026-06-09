import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePromptVersionDto } from './dto/create-prompt-version.dto';
import { AiApprovalStatus, AiSafetyResult, PromptUsageDefinition, ResolvedPromptVersion } from './ai-governance.types';
export declare const PROMPT_USAGE_REGISTRY: PromptUsageDefinition[];
export declare class AiGovernanceService {
    private readonly prisma;
    private readonly auditService;
    constructor(prisma: PrismaService, auditService: AuditService);
    listPrompts(tenantId: string): Promise<{
        activeVersion: {
            id: string;
            createdAt: Date;
            tenantId: string;
            status: string;
            createdBy: string | null;
            version: string;
            moduleName: string;
            promptKey: string;
            promptText: string;
        } | null;
        versions: {
            id: string;
            createdAt: Date;
            tenantId: string;
            status: string;
            createdBy: string | null;
            version: string;
            moduleName: string;
            promptKey: string;
            promptText: string;
        }[];
        moduleName: string;
        promptKey: string;
        label: string;
        description: string;
        defaultVersion: string;
    }[]>;
    createPromptVersion(tenantId: string, userId: string, dto: CreatePromptVersionDto): Promise<{
        id: string;
        createdAt: Date;
        tenantId: string;
        status: string;
        createdBy: string | null;
        version: string;
        moduleName: string;
        promptKey: string;
        promptText: string;
    }>;
    activatePromptVersion(id: string, tenantId: string, userId: string): Promise<{
        id: string;
        createdAt: Date;
        tenantId: string;
        status: string;
        createdBy: string | null;
        version: string;
        moduleName: string;
        promptKey: string;
        promptText: string;
    }>;
    deactivatePromptVersion(id: string, tenantId: string, userId: string): Promise<{
        id: string;
        createdAt: Date;
        tenantId: string;
        status: string;
        createdBy: string | null;
        version: string;
        moduleName: string;
        promptKey: string;
        promptText: string;
    }>;
    resolvePromptVersion(input: {
        tenantId: string;
        moduleName: string;
        promptKey?: string;
        fallbackVersion?: string;
    }): Promise<ResolvedPromptVersion>;
    findAudit(tenantId: string): Promise<any[]>;
    findAuditById(id: string, tenantId: string): Promise<any>;
    approveGeneration(id: string, tenantId: string, userId: string): Promise<any>;
    evaluateSafety(input: {
        generatedOutput: unknown;
        inputSource?: unknown;
        clientVisible?: boolean;
    }): AiSafetyResult;
    approvalStatusFor(input: {
        clientVisible?: boolean;
        safetyStatus: AiSafetyResult['status'];
    }): AiApprovalStatus;
    toJsonValue(value: unknown): Prisma.InputJsonValue;
    private ensureKnownPrompt;
    private findPrompt;
    private defaultPromptKeyFor;
    private defaultVersionFor;
    private serializeGeneration;
    private stringifyTextValues;
    private inputReferencesMultipleClients;
}
