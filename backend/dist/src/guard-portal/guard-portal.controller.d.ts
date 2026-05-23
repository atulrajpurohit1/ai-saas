import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { GuardPortalService } from './guard-portal.service';
export declare class GuardPortalController {
    private readonly guardPortalService;
    constructor(guardPortalService: GuardPortalService);
    private getGuardContext;
    me(user: ActiveUser): Promise<{
        id: string;
        name: string;
        phone: string | null;
        email: string | null;
        availabilityStatus: string;
    }>;
    shifts(user: ActiveUser): Promise<{
        id: string;
        shiftId: string;
        siteName: string;
        siteAddress: string;
        startTime: Date;
        endTime: Date;
        status: string;
        assignmentStatus: string;
    }[]>;
    shiftDetail(user: ActiveUser, id: string): Promise<{
        id: string;
        shiftId: string;
        startTime: Date;
        endTime: Date;
        status: string;
        assignmentStatus: string;
        site: {
            id: string;
            name: string;
            address: string;
            instructions: string | null;
        };
        assignedGuard: {
            id: string;
            name: string;
            phone: string | null;
            email: string | null;
        };
    }>;
}
