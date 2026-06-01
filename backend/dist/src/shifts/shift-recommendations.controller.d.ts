import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { ShiftsService } from './shifts.service';
export declare class ShiftRecommendationsController {
    private readonly shiftsService;
    constructor(shiftsService: ShiftsService);
    recommendGuards(user: ActiveUser, id: string): Promise<import("../ai-insights/ai-insights.types").GuardRecommendation[]>;
}
