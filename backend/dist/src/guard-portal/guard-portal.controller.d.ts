import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { GuardPortalService } from './guard-portal.service';
import { SyncOfflineActionsDto } from './dto/sync-offline-actions.dto';
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
        attendanceStatus: "not_started" | "checked_in" | "completed";
        checkInTime: Date | null;
        checkOutTime: Date | null;
    }[]>;
    shiftDetail(user: ActiveUser, id: string): Promise<{
        id: string;
        shiftId: string;
        startTime: Date;
        endTime: Date;
        status: string;
        assignmentStatus: string;
        attendanceStatus: "not_started" | "checked_in" | "completed";
        checkInTime: Date | null;
        checkOutTime: Date | null;
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
    checkIn(user: ActiveUser, id: string): Promise<{
        message: string;
        shiftStatus: string;
        attendanceStatus: string;
        checkInTime: Date;
        checkOutTime: null;
    }>;
    checkOut(user: ActiveUser, id: string): Promise<{
        message: string;
        shiftStatus: string;
        attendanceStatus: string;
        checkInTime: Date;
        checkOutTime: Date;
        timesheetId: string;
        timesheetStatus: string;
        totalHours: number;
    }>;
    syncOfflineActions(user: ActiveUser, dto: SyncOfflineActionsDto): Promise<{
        id: string;
        createdAt: Date;
        tenantId: string;
        status: string;
        payload: import("@prisma/client/runtime/library").JsonValue;
        guardId: string;
        errorMessage: string | null;
        actionType: string;
        syncedAt: Date | null;
    }[]>;
    syncStatus(user: ActiveUser): Promise<{
        id: string;
        createdAt: Date;
        tenantId: string;
        status: string;
        payload: import("@prisma/client/runtime/library").JsonValue;
        guardId: string;
        errorMessage: string | null;
        actionType: string;
        syncedAt: Date | null;
    }[]>;
}
