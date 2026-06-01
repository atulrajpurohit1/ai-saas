import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { IncidentsService } from './incidents.service';
export declare class GuardIncidentsController {
    private readonly incidentsService;
    constructor(incidentsService: IncidentsService);
    private getGuardContext;
    createForShift(user: ActiveUser, shiftId: string, dto: CreateIncidentDto): Promise<{
        id: string;
        tenantId: string;
        shiftId: string;
        siteId: string;
        guardId: string;
        title: string;
        description: string;
        severity: string;
        status: "under_review" | "approved" | "rejected" | "submitted";
        occurredAt: Date;
        attachmentUrl: string | null;
        notes: string | null;
        createdAt: Date;
        submittedAt: Date;
        reviewedById: string | null;
        reviewedBy: {
            id: string;
            name: string | null;
            email: string | null;
        } | null;
        reviewedAt: Date | null;
        reviewNote: string | null;
        site: {
            id: string;
            name: string;
            address: string;
        };
        guard: {
            id: string;
            name: string;
            email: string | null;
            phone: string | null;
        };
        shift: {
            id: string;
            startTime: Date;
            endTime: Date;
        };
    }>;
    findMine(user: ActiveUser): Promise<{
        id: string;
        tenantId: string;
        shiftId: string;
        siteId: string;
        guardId: string;
        title: string;
        description: string;
        severity: string;
        status: "under_review" | "approved" | "rejected" | "submitted";
        occurredAt: Date;
        attachmentUrl: string | null;
        notes: string | null;
        createdAt: Date;
        submittedAt: Date;
        reviewedById: string | null;
        reviewedBy: {
            id: string;
            name: string | null;
            email: string | null;
        } | null;
        reviewedAt: Date | null;
        reviewNote: string | null;
        site: {
            id: string;
            name: string;
            address: string;
        };
        guard: {
            id: string;
            name: string;
            email: string | null;
            phone: string | null;
        };
        shift: {
            id: string;
            startTime: Date;
            endTime: Date;
        };
    }[]>;
}
