import { PrismaService } from '../prisma/prisma.service';
import { CreateShiftDto } from './dto/create-shift.dto';
import { AuditService } from '../audit/audit.service';
import { AiService } from '../ai/ai.service';
type AttendanceStatus = 'not_started' | 'checked_in' | 'completed';
type GuardRecommendation = {
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
};
export declare class ShiftsService {
    private prisma;
    private auditService;
    private aiService;
    constructor(prisma: PrismaService, auditService: AuditService, aiService: AiService);
    private summarizeAttendance;
    private datesOverlap;
    private isUnavailableForShift;
    private isLateCheckIn;
    private roundScore;
    private roundPercent;
    private fallbackRecommendationExplanation;
    private explainRecommendation;
    private buildGuardRecommendations;
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
    recommendGuards(userId: string, tenantId: string, shiftId: string): Promise<GuardRecommendation[]>;
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
