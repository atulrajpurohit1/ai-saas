import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { CorrectTimesheetDto } from './dto/correct-timesheet.dto';
import { RejectTimesheetDto } from './dto/reject-timesheet.dto';
import { TimesheetsService } from './timesheets.service';
export declare class TimesheetsController {
    private readonly timesheetsService;
    constructor(timesheetsService: TimesheetsService);
    findAll(user: ActiveUser, status?: string, branchId?: string): Promise<{
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
    findOne(user: ActiveUser, id: string): Promise<{
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
    approve(user: ActiveUser, id: string): Promise<{
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
}
