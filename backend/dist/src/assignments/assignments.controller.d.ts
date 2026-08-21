import { AssignmentsService } from './assignments.service';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
export declare class AssignmentsController {
    private readonly assignmentsService;
    constructor(assignmentsService: AssignmentsService);
    findAll(user: ActiveUser): Promise<({
        shift: {
            site: {
                id: string;
                name: string;
                createdAt: Date;
                tenantId: string;
                branchId: string | null;
                clientId: string | null;
                address: string;
                instructions: string | null;
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
        };
        guard: {
            id: string;
            name: string;
            createdAt: Date;
            documents: string | null;
            email: string | null;
            tenantId: string;
            branchId: string | null;
            phone: string | null;
            passwordHash: string | null;
            salary: number | null;
            bankDetails: string | null;
            personalNotes: string | null;
        };
    } & {
        id: string;
        createdAt: Date;
        status: string;
        guardId: string;
        shiftId: string;
    })[]>;
}
