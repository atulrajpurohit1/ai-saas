import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { ShiftsService } from './shifts.service';
export declare class ShiftRecommendationsController {
    private readonly shiftsService;
    constructor(shiftsService: ShiftsService);
    recommendGuards(user: ActiveUser, id: string): Promise<{
        guard_id: string;
        guard_name: string;
        score: number;
        reasons: string[];
        warnings: string[];
        explanation: string;
        metrics: {
            attendance_rate: number | null;
            site_shifts: number;
            late_check_ins: number;
            missed_shifts: number;
            incidents: number;
            upcoming_workload: number;
        };
    }[]>;
}
