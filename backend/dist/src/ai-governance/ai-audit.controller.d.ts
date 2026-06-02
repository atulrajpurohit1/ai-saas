import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { AiGovernanceService } from './ai-governance.service';
export declare class AiAuditController {
    private readonly aiGovernanceService;
    constructor(aiGovernanceService: AiGovernanceService);
    findAll(user: ActiveUser): Promise<any[]>;
    findOne(user: ActiveUser, id: string): Promise<any>;
    approve(user: ActiveUser, id: string): Promise<any>;
}
