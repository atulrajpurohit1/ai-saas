import { PrismaService } from '../prisma/prisma.service';
import { CreateShiftDto } from './dto/create-shift.dto';
import { AuditService } from '../audit/audit.service';
import { RecommendationService } from '../ai-insights/recommendation.service';
import { GuardRecommendation } from '../ai-insights/ai-insights.types';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { WebhooksService } from '../webhooks/webhooks.service';
type AttendanceStatus = 'not_started' | 'checked_in' | 'completed';
export declare class ShiftsService {
    private prisma;
    private auditService;
    private recommendationService;
    private webhooksService;
    constructor(prisma: PrismaService, auditService: AuditService, recommendationService: RecommendationService, webhooksService: WebhooksService);
    private summarizeAttendance;
    create(user: ActiveUser, dto: CreateShiftDto): Promise<{
        site: {
            name: string;
        };
    } & {
        id: string;
        createdAt: Date;
        tenantId: string;
        branchId: string | null;
        status: string;
        siteId: string;
        startTime: Date;
        endTime: Date;
        requiredGuards: number;
    }>;
    findAll(user: ActiveUser, requestedBranchId?: string | null): Promise<{
        attendanceStatus: AttendanceStatus;
        checkInTime: Date | null;
        checkOutTime: Date | null;
        branch: {
            id: string;
            name: string;
            status: string;
            location: string;
        } | null;
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
        branchId: string | null;
        status: string;
        siteId: string;
        startTime: Date;
        endTime: Date;
        requiredGuards: number;
    }[]>;
    recommendGuards(user: ActiveUser, shiftId: string): Promise<GuardRecommendation[]>;
    assign(user: ActiveUser, shiftId: string, guardId: string): Promise<{
        id: string;
        createdAt: Date;
        status: string;
        guardId: string;
        shiftId: string;
    }>;
    unassign(user: ActiveUser, shiftId: string): Promise<{
        message: string;
    }>;
}
export {};
