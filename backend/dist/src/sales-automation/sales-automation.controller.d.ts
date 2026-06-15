import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { SalesAutomationService } from './sales-automation.service';
export declare class SalesAutomationController {
    private readonly salesAutomationService;
    constructor(salesAutomationService: SalesAutomationService);
    status(): {
        enabled: boolean;
        intervalMinutes: number;
        running: boolean;
        lastRunAt: Date | null;
        lastRunSummary: import("./sales-automation.service").AutomationRunSummary | null;
        marker: string;
    };
    run(user: ActiveUser): Promise<import("./sales-automation.service").AutomationRunSummary>;
}
