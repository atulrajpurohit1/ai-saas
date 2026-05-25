import { ShiftsService } from './shifts.service';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { CreateShiftDto } from './dto/create-shift.dto';
import { AssignGuardDto } from './dto/assign-guard.dto';
export declare class ShiftsController {
    private readonly shiftsService;
    constructor(shiftsService: ShiftsService);
    create(user: ActiveUser, createShiftDto: CreateShiftDto): Promise<{
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
    findAll(user: ActiveUser): Promise<{
        attendanceStatus: "not_started" | "checked_in" | "completed";
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
    assign(user: ActiveUser, id: string, dto: AssignGuardDto): Promise<{
        id: string;
        createdAt: Date;
        status: string;
        guardId: string;
        shiftId: string;
    }>;
    unassign(user: ActiveUser, id: string): Promise<{
        message: string;
    }>;
}
