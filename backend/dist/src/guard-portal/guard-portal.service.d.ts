import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
type AttendanceStatus = 'not_started' | 'checked_in' | 'completed';
export declare class GuardPortalService {
    private prisma;
    private auditService;
    constructor(prisma: PrismaService, auditService: AuditService);
    private summarizeAttendance;
    private logInvalidAttendanceAttempt;
    private isDuplicateAttendanceEvent;
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
    }>;
}
export {};
