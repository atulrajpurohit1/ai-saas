import { PrismaService } from '../prisma/prisma.service';
import { CreateShiftDto } from './dto/create-shift.dto';
import { AuditService } from '../audit/audit.service';
type AttendanceStatus = 'not_started' | 'checked_in' | 'completed';
export declare class ShiftsService {
    private prisma;
    private auditService;
    constructor(prisma: PrismaService, auditService: AuditService);
    private summarizeAttendance;
    create(userId: string, tenantId: string, dto: CreateShiftDto): Promise<{
        site: {
            name: string;
        };
    } & {
        id: string;
        createdAt: Date;
        tenantId: string;
        status: string;
        siteId: string;
        startTime: Date;
        endTime: Date;
        requiredGuards: number;
    }>;
    findAll(tenantId: string): Promise<{
        attendanceStatus: AttendanceStatus;
        checkInTime: Date | null;
        checkOutTime: Date | null;
        site: {
            name: string;
        };
        assignments: ({
            guard: {
                name: string;
            };
        } & {
            id: string;
            createdAt: Date;
            status: string;
            guardId: string;
            shiftId: string;
        })[];
        id: string;
        createdAt: Date;
        tenantId: string;
        status: string;
        siteId: string;
        startTime: Date;
        endTime: Date;
        requiredGuards: number;
    }[]>;
    assign(userId: string, tenantId: string, shiftId: string, guardId: string): Promise<{
        id: string;
        createdAt: Date;
        status: string;
        guardId: string;
        shiftId: string;
    }>;
    unassign(userId: string, tenantId: string, shiftId: string): Promise<{
        message: string;
    }>;
}
export {};
