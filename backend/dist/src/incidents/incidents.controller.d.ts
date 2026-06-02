import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { ReviewIncidentDto } from './dto/review-incident.dto';
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
        status: "approved" | "rejected" | "under_review" | "submitted";
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
    findReviewQueue(user: ActiveUser): Promise<{
        id: string;
        tenantId: string;
        shiftId: string;
        siteId: string;
        guardId: string;
        title: string;
        description: string;
        severity: string;
        status: "approved" | "rejected" | "under_review" | "submitted";
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
    findOne(user: ActiveUser, id: string): Promise<{
        id: string;
        tenantId: string;
        shiftId: string;
        siteId: string;
        guardId: string;
        title: string;
        description: string;
        severity: string;
        status: "approved" | "rejected" | "under_review" | "submitted";
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
    review(user: ActiveUser, id: string, dto: ReviewIncidentDto): Promise<{
        id: string;
        tenantId: string;
        shiftId: string;
        siteId: string;
        guardId: string;
        title: string;
        description: string;
        severity: string;
        status: "approved" | "rejected" | "under_review" | "submitted";
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
}
