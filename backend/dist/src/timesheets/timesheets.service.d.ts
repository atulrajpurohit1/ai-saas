import { AuditService } from '../audit/audit.service';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import { CorrectTimesheetDto } from './dto/correct-timesheet.dto';
import { RejectTimesheetDto } from './dto/reject-timesheet.dto';
declare const TIMESHEET_STATUSES: readonly ["pending", "approved", "rejected", "corrected"];
export type TimesheetStatus = (typeof TIMESHEET_STATUSES)[number];
export declare class TimesheetsService {
    private prisma;
    private auditService;
    constructor(prisma: PrismaService, auditService: AuditService);
    isValidStatus(status: string): status is TimesheetStatus;
    private timesheetInclude;
    private mapTimesheet;
    private timesheetBranchWhere;
    private findTimesheetOrThrow;
    private assertNotInvoiced;
    private parseOptionalDate;
    findAllForAdmin(user: ActiveUser, status?: string, requestedBranchId?: string | null): Promise<{
        id: any;
        tenantId: any;
        guardId: any;
        shiftId: any;
        siteId: any;
        clientId: any;
        checkInTime: any;
        checkOutTime: any;
        totalHours: any;
        status: any;
        approvedBy: any;
        approvedAt: any;
        rejectionReason: any;
        createdAt: any;
        guard: {
            id: any;
            name: any;
            email: any;
            phone: any;
        } | null;
        shift: {
            id: any;
            branchId: any;
            startTime: any;
            endTime: any;
            status: any;
        } | null;
        site: {
            id: any;
            name: any;
            address: any;
        } | null;
        client: {
            id: any;
            name: any;
            companyName: any;
            email: any;
        } | null;
    }[]>;
    findOneForAdmin(user: ActiveUser, id: string): Promise<{
        id: any;
        tenantId: any;
        guardId: any;
        shiftId: any;
        siteId: any;
        clientId: any;
        checkInTime: any;
        checkOutTime: any;
        totalHours: any;
        status: any;
        approvedBy: any;
        approvedAt: any;
        rejectionReason: any;
        createdAt: any;
        guard: {
            id: any;
            name: any;
            email: any;
            phone: any;
        } | null;
        shift: {
            id: any;
            branchId: any;
            startTime: any;
            endTime: any;
            status: any;
        } | null;
        site: {
            id: any;
            name: any;
            address: any;
        } | null;
        client: {
            id: any;
            name: any;
            companyName: any;
            email: any;
        } | null;
    }>;
    approve(user: ActiveUser, timesheetId: string): Promise<{
        id: any;
        tenantId: any;
        guardId: any;
        shiftId: any;
        siteId: any;
        clientId: any;
        checkInTime: any;
        checkOutTime: any;
        totalHours: any;
        status: any;
        approvedBy: any;
        approvedAt: any;
        rejectionReason: any;
        createdAt: any;
        guard: {
            id: any;
            name: any;
            email: any;
            phone: any;
        } | null;
        shift: {
            id: any;
            branchId: any;
            startTime: any;
            endTime: any;
            status: any;
        } | null;
        site: {
            id: any;
            name: any;
            address: any;
        } | null;
        client: {
            id: any;
            name: any;
            companyName: any;
            email: any;
        } | null;
    }>;
    reject(user: ActiveUser, id: string, dto: RejectTimesheetDto): Promise<{
        id: any;
        tenantId: any;
        guardId: any;
        shiftId: any;
        siteId: any;
        clientId: any;
        checkInTime: any;
        checkOutTime: any;
        totalHours: any;
        status: any;
        approvedBy: any;
        approvedAt: any;
        rejectionReason: any;
        createdAt: any;
        guard: {
            id: any;
            name: any;
            email: any;
            phone: any;
        } | null;
        shift: {
            id: any;
            branchId: any;
            startTime: any;
            endTime: any;
            status: any;
        } | null;
        site: {
            id: any;
            name: any;
            address: any;
        } | null;
        client: {
            id: any;
            name: any;
            companyName: any;
            email: any;
        } | null;
    }>;
    correct(user: ActiveUser, id: string, dto: CorrectTimesheetDto): Promise<{
        id: any;
        tenantId: any;
        guardId: any;
        shiftId: any;
        siteId: any;
        clientId: any;
        checkInTime: any;
        checkOutTime: any;
        totalHours: any;
        status: any;
        approvedBy: any;
        approvedAt: any;
        rejectionReason: any;
        createdAt: any;
        guard: {
            id: any;
            name: any;
            email: any;
            phone: any;
        } | null;
        shift: {
            id: any;
            branchId: any;
            startTime: any;
            endTime: any;
            status: any;
        } | null;
        site: {
            id: any;
            name: any;
            address: any;
        } | null;
        client: {
            id: any;
            name: any;
            companyName: any;
            email: any;
        } | null;
    }>;
    private guardLabel;
    private siteLabel;
}
export {};
