import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { AiMonitoringService } from './ai-monitoring.service';
export declare class AiMonitoringController {
    private readonly aiMonitoringService;
    constructor(aiMonitoringService: AiMonitoringService);
    getMonitoring(user: ActiveUser): Promise<import("./ai-monitoring.types").AiMonitoringMetrics>;
}
