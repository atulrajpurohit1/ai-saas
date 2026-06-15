import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { IncidentsService } from '../incidents/incidents.service';
import { PatrolsService } from '../patrols/patrols.service';
import { SyncOfflineActionsDto } from './dto/sync-offline-actions.dto';
type AttendanceStatus = 'not_started' | 'checked_in' | 'completed';
export declare class GuardPortalService {
    private prisma;
    private auditService;
    private incidentsService;
    private patrolsService;
    constructor(prisma: PrismaService, auditService: AuditService, incidentsService: IncidentsService, patrolsService: PatrolsService);
    private summarizeAttendance;
    private logInvalidAttendanceAttempt;
    private isDuplicateAttendanceEvent;
    private roundHours;
    private getAssignedShiftContext;
    getProfile(tenantId: string, guardId: string): Promise<{
        id: string;
        name: string;
        phone: string | null;
        email: string | null;
        availabilityStatus: string;
    }>;
    getAssignedShifts(tenantId: string, guardId: string): Promise<{
        id: string;
        shiftId: string;
        siteName: string;
        siteAddress: string;
        startTime: Date;
        endTime: Date;
        status: string;
        assignmentStatus: string;
        attendanceStatus: AttendanceStatus;
        checkInTime: Date | null;
        checkOutTime: Date | null;
    }[]>;
    getShiftDetail(tenantId: string, guardId: string, shiftId: string): Promise<{
        id: string;
        shiftId: string;
        startTime: Date;
        endTime: Date;
        status: string;
        assignmentStatus: string;
        attendanceStatus: AttendanceStatus;
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
    checkIn(tenantId: string, guardId: string, shiftId: string): Promise<{
        message: string;
        shiftStatus: string;
        attendanceStatus: string;
        checkInTime: Date;
        checkOutTime: null;
    }>;
    checkOut(tenantId: string, guardId: string, shiftId: string): Promise<{
        message: string;
        shiftStatus: string;
        attendanceStatus: string;
        checkInTime: Date;
        checkOutTime: Date;
        timesheetId: string;
        timesheetStatus: string;
        totalHours: number;
    }>;
    getSyncStatus(tenantId: string, guardId: string): Promise<{
        id: string;
        createdAt: Date;
        tenantId: string;
        status: string;
        payload: Prisma.JsonValue;
        guardId: string;
        errorMessage: string | null;
        actionType: string;
        syncedAt: Date | null;
    }[]>;
    processSyncQueue(tenantId: string, guardId: string, dto: SyncOfflineActionsDto): Promise<{
        id: string;
        createdAt: Date;
        tenantId: string;
        status: string;
        payload: Prisma.JsonValue;
        guardId: string;
        errorMessage: string | null;
        actionType: string;
        syncedAt: Date | null;
    }[]>;
}
export {};
