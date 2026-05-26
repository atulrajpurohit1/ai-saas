import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { ReviewIncidentDto } from './dto/review-incident.dto';
type IncidentStatus = 'submitted' | 'under_review' | 'approved' | 'rejected';
export declare class IncidentsService {
    private prisma;
    private auditService;
    constructor(prisma: PrismaService, auditService: AuditService);
    private mapIncident;
    private mapClientIncident;
    private mapClientIncidentListItem;
    private incidentSelectSql;
    private validateCreateDto;
    private validateReviewStatus;
    private moveSubmittedIncidentToReview;
    createForGuard(tenantId: string, guardId: string, shiftId: string, dto: CreateIncidentDto): Promise<{
        id: string;
        tenantId: string;
        shiftId: string;
        siteId: string;
        guardId: string;
        title: string;
        description: string;
        severity: string;
        status: IncidentStatus;
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
    findForGuard(tenantId: string, guardId: string): Promise<{
        id: string;
        tenantId: string;
        shiftId: string;
        siteId: string;
        guardId: string;
        title: string;
        description: string;
        severity: string;
        status: IncidentStatus;
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
    findAllForAdmin(tenantId: string): Promise<{
        id: string;
        tenantId: string;
        shiftId: string;
        siteId: string;
        guardId: string;
        title: string;
        description: string;
        severity: string;
        status: IncidentStatus;
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
    findReviewQueueForAdmin(tenantId: string): Promise<{
        id: string;
        tenantId: string;
        shiftId: string;
        siteId: string;
        guardId: string;
        title: string;
        description: string;
        severity: string;
        status: IncidentStatus;
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
    findOneForAdmin(tenantId: string, incidentId: string, userId: string): Promise<{
        id: string;
        tenantId: string;
        shiftId: string;
        siteId: string;
        guardId: string;
        title: string;
        description: string;
        severity: string;
        status: IncidentStatus;
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
    reviewIncident(tenantId: string, incidentId: string, userId: string, dto: ReviewIncidentDto): Promise<{
        id: string;
        tenantId: string;
        shiftId: string;
        siteId: string;
        guardId: string;
        title: string;
        description: string;
        severity: string;
        status: IncidentStatus;
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
    findApprovedForClient(tenantId: string, clientId: string, userId: string): Promise<{
        id: string;
        title: string;
        severity: string;
        status: "approved";
        occurredAt: Date;
        site: {
            id: string;
            name: string;
        };
    }[]>;
    findApprovedDetailForClient(tenantId: string, clientId: string, userId: string, incidentId: string): Promise<{
        id: string;
        title: string;
        description: string;
        severity: string;
        status: "approved";
        occurredAt: Date;
        attachmentUrl: string | null;
        reviewedAt: Date | null;
        site: {
            id: string;
            name: string;
            address: string;
        };
    }>;
}
export {};
