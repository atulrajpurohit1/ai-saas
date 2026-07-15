import { AuditService } from '../audit/audit.service';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { BrandingService } from '../branding/branding.service';
import { PrismaService } from '../prisma/prisma.service';
import { GenerateDailyReportDto } from './dto/generate-daily-report.dto';
type AttendanceStatus = 'not_started' | 'checked_in' | 'completed';
type GuardReportSummary = {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    assignmentStatus: string;
    attendanceStatus: AttendanceStatus;
    checkInTime: string | null;
    checkOutTime: string | null;
    totalWorkedHours: number;
};
type ShiftReportSummary = {
    id: string;
    status: string;
    startTime: string;
    endTime: string;
    assignedGuards: GuardReportSummary[];
};
type IncidentReportSummary = {
    id: string;
    title: string;
    description: string;
    severity: string;
    occurredAt: string;
    attachmentUrl: string | null;
    guard: {
        id: string;
        name: string;
    };
    shift: {
        id: string;
        startTime: string;
        endTime: string;
    };
};
type DailyReportSummary = {
    reportDate: string;
    site: {
        id: string;
        name: string;
        address: string;
        instructions: string | null;
    };
    client: {
        id: string;
        name: string;
        companyName: string | null;
    };
    totals: {
        shifts: number;
        assignedGuards: number;
        completedAttendances: number;
        checkedInAttendances: number;
        missedAttendances: number;
        totalWorkedHours: number;
        approvedIncidents: number;
    };
    shifts: ShiftReportSummary[];
    incidents: IncidentReportSummary[];
};
export declare class ReportsService {
    private prisma;
    private auditService;
    private brandingService;
    constructor(prisma: PrismaService, auditService: AuditService, brandingService: BrandingService);
    private parseReportDate;
    private summarizeAttendance;
    private parseStoredSummary;
    private mapReport;
    private reportInclude;
    private findReportOrThrow;
    private findClientReportOrThrow;
    private buildDailySummary;
    private formatDate;
    private addPdfSectionTitle;
    private buildPdfBuffer;
    generateDailyReport(user: ActiveUser, dto: GenerateDailyReportDto): Promise<{
        id: any;
        tenantId: any;
        clientId: any;
        siteId: any;
        branchId: any;
        reportDate: any;
        status: any;
        createdAt: any;
        publishedAt: any;
        summary: DailyReportSummary | {
            raw: string;
        };
        client: {
            id: any;
            name: any;
            companyName: any;
            email: any;
        } | null;
        site: {
            id: any;
            name: any;
            address: any;
        } | null;
    }>;
    findAllForAdmin(user: ActiveUser, requestedBranchId?: string | null): Promise<{
        id: any;
        tenantId: any;
        clientId: any;
        siteId: any;
        branchId: any;
        reportDate: any;
        status: any;
        createdAt: any;
        publishedAt: any;
        summary: DailyReportSummary | {
            raw: string;
        };
        client: {
            id: any;
            name: any;
            companyName: any;
            email: any;
        } | null;
        site: {
            id: any;
            name: any;
            address: any;
        } | null;
    }[]>;
    findOneForAdmin(user: ActiveUser, id: string): Promise<{
        id: any;
        tenantId: any;
        clientId: any;
        siteId: any;
        branchId: any;
        reportDate: any;
        status: any;
        createdAt: any;
        publishedAt: any;
        summary: DailyReportSummary | {
            raw: string;
        };
        client: {
            id: any;
            name: any;
            companyName: any;
            email: any;
        } | null;
        site: {
            id: any;
            name: any;
            address: any;
        } | null;
    }>;
    publishReport(user: ActiveUser, id: string): Promise<{
        id: any;
        tenantId: any;
        clientId: any;
        siteId: any;
        branchId: any;
        reportDate: any;
        status: any;
        createdAt: any;
        publishedAt: any;
        summary: DailyReportSummary | {
            raw: string;
        };
        client: {
            id: any;
            name: any;
            companyName: any;
            email: any;
        } | null;
        site: {
            id: any;
            name: any;
            address: any;
        } | null;
    }>;
    exportForAdmin(user: ActiveUser, id: string): Promise<{
        buffer: Buffer<ArrayBufferLike>;
        report: {
            id: any;
            tenantId: any;
            clientId: any;
            siteId: any;
            branchId: any;
            reportDate: any;
            status: any;
            createdAt: any;
            publishedAt: any;
            summary: DailyReportSummary | {
                raw: string;
            };
            client: {
                id: any;
                name: any;
                companyName: any;
                email: any;
            } | null;
            site: {
                id: any;
                name: any;
                address: any;
            } | null;
        };
    }>;
    findAllForClient(tenantId: string, clientId: string, userId: string): Promise<{
        id: any;
        tenantId: any;
        clientId: any;
        siteId: any;
        branchId: any;
        reportDate: any;
        status: any;
        createdAt: any;
        publishedAt: any;
        summary: DailyReportSummary | {
            raw: string;
        };
        client: {
            id: any;
            name: any;
            companyName: any;
            email: any;
        } | null;
        site: {
            id: any;
            name: any;
            address: any;
        } | null;
    }[]>;
    findOneForClient(tenantId: string, clientId: string, userId: string, id: string): Promise<{
        id: any;
        tenantId: any;
        clientId: any;
        siteId: any;
        branchId: any;
        reportDate: any;
        status: any;
        createdAt: any;
        publishedAt: any;
        summary: DailyReportSummary | {
            raw: string;
        };
        client: {
            id: any;
            name: any;
            companyName: any;
            email: any;
        } | null;
        site: {
            id: any;
            name: any;
            address: any;
        } | null;
    }>;
    downloadForClient(tenantId: string, clientId: string, userId: string, id: string): Promise<{
        buffer: Buffer<ArrayBufferLike>;
        report: {
            id: any;
            tenantId: any;
            clientId: any;
            siteId: any;
            branchId: any;
            reportDate: any;
            status: any;
            createdAt: any;
            publishedAt: any;
            summary: DailyReportSummary | {
                raw: string;
            };
            client: {
                id: any;
                name: any;
                companyName: any;
                email: any;
            } | null;
            site: {
                id: any;
                name: any;
                address: any;
            } | null;
        };
    }>;
}
export {};
