import { AuditService } from '../audit/audit.service';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { ReviewIncidentDto } from './dto/review-incident.dto';
type IncidentStatus = 'submitted' | 'under_review' | 'approved' | 'rejected';
export declare class IncidentsService {
    private prisma;
    private auditService;
    private webhooksService;
    constructor(prisma: PrismaService, auditService: AuditService, webhooksService: WebhooksService);
    private mapIncident;
    private mapClientIncident;
    private mapClientIncidentListItem;
    private incidentSelectSql;
    private validateCreateDto;
    private validateReviewStatus;
    private adminBranchSql;
    private moveSubmittedIncidentToReview;
    createForGuard(tenantId: string, guardId: string, shiftId: string, dto: CreateIncidentDto): Promise<{
        id: string;
        tenantId: string;
        branchId: string | null;
        branch: {
            id: string;
            name: string | null;
            location: string | null;
            status: string | null;
        } | null;
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
        branchId: string | null;
        branch: {
            id: string;
            name: string | null;
            location: string | null;
            status: string | null;
        } | null;
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
    findAllForAdmin(user: ActiveUser, requestedBranchId?: string | null): Promise<{
        id: string;
        tenantId: string;
        branchId: string | null;
        branch: {
            id: string;
            name: string | null;
            location: string | null;
            status: string | null;
        } | null;
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
    findReviewQueueForAdmin(user: ActiveUser, requestedBranchId?: string | null): Promise<{
        id: string;
        tenantId: string;
        branchId: string | null;
        branch: {
            id: string;
            name: string | null;
            location: string | null;
            status: string | null;
        } | null;
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
    findOneForAdmin(user: ActiveUser, incidentId: string): Promise<{
        id: string;
        tenantId: string;
        branchId: string | null;
        branch: {
            id: string;
            name: string | null;
            location: string | null;
            status: string | null;
        } | null;
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
    reviewIncident(user: ActiveUser, incidentId: string, dto: ReviewIncidentDto): Promise<{
        id: string;
        tenantId: string;
        branchId: string | null;
        branch: {
            id: string;
            name: string | null;
            location: string | null;
            status: string | null;
        } | null;
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
