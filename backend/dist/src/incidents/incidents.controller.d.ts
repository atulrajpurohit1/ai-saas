import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { IncidentsService } from './incidents.service';
export declare class IncidentsController {
    private readonly incidentsService;
    constructor(incidentsService: IncidentsService);
    findAll(user: ActiveUser): Promise<{
        id: string;
        tenantId: string;
        shiftId: string;
        siteId: string;
        guardId: string;
        title: string;
        description: string;
        severity: string;
        status: "rejected" | "submitted" | "reviewed";
        occurredAt: Date;
        attachmentUrl: string | null;
        notes: string | null;
        createdAt: Date;
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
    findOne(user: ActiveUser, id: string): Promise<{
        id: string;
        tenantId: string;
        shiftId: string;
        siteId: string;
        guardId: string;
        title: string;
        description: string;
        severity: string;
        status: "rejected" | "submitted" | "reviewed";
        occurredAt: Date;
        attachmentUrl: string | null;
        notes: string | null;
        createdAt: Date;
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
}
