import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { AiGovernanceService } from './ai-governance.service';
import { CreatePromptVersionDto } from './dto/create-prompt-version.dto';
export declare class AiPromptsController {
    private readonly aiGovernanceService;
    constructor(aiGovernanceService: AiGovernanceService);
    findAll(user: ActiveUser): Promise<{
        activeVersion: {
            id: string;
            createdAt: Date;
            tenantId: string;
            status: string;
            version: string;
            moduleName: string;
            promptKey: string;
            promptText: string;
            createdBy: string | null;
        } | null;
        versions: {
            id: string;
            createdAt: Date;
            tenantId: string;
            status: string;
            version: string;
            moduleName: string;
            promptKey: string;
            promptText: string;
            createdBy: string | null;
        }[];
        moduleName: string;
        promptKey: string;
        label: string;
        description: string;
        defaultVersion: string;
    }[]>;
    create(user: ActiveUser, dto: CreatePromptVersionDto): Promise<{
        id: string;
        createdAt: Date;
        tenantId: string;
        status: string;
        version: string;
        moduleName: string;
        promptKey: string;
        promptText: string;
        createdBy: string | null;
    }>;
    activate(user: ActiveUser, id: string): Promise<{
        id: string;
        createdAt: Date;
        tenantId: string;
        status: string;
        version: string;
        moduleName: string;
        promptKey: string;
        promptText: string;
        createdBy: string | null;
    }>;
    deactivate(user: ActiveUser, id: string): Promise<{
        id: string;
        createdAt: Date;
        tenantId: string;
        status: string;
        version: string;
        moduleName: string;
        promptKey: string;
        promptText: string;
        createdBy: string | null;
    }>;
}
