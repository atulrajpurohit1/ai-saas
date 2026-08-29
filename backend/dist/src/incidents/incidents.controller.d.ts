import { Response } from 'express';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { ReviewIncidentDto } from './dto/review-incident.dto';
import { IncidentsService } from './incidents.service';
export declare class IncidentsController {
    private readonly incidentsService;
    constructor(incidentsService: IncidentsService);
    findAll(user: ActiveUser, branchId?: string): Promise<{
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
        status: "approved" | "rejected" | "submitted" | "under_review";
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
    findReviewQueue(user: ActiveUser, branchId?: string): Promise<{
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
        status: "approved" | "rejected" | "submitted" | "under_review";
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
        status: "approved" | "rejected" | "submitted" | "under_review";
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
        status: "approved" | "rejected" | "submitted" | "under_review";
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
    listEvidence(user: ActiveUser, id: string): Promise<{
        id: string;
        incidentId: string;
        mediaType: string;
        mimeType: string;
        fileName: string;
        fileSizeBytes: number;
        uploadedById: string | null;
        createdAt: Date;
    }[]>;
    uploadEvidence(user: ActiveUser, id: string, file: Express.Multer.File): Promise<{
        id: string;
        incidentId: string;
        mediaType: string;
        mimeType: string;
        fileName: string;
        fileSizeBytes: number;
        uploadedById: string | null;
        createdAt: Date;
    }>;
    downloadEvidence(user: ActiveUser, id: string, evidenceId: string, res: Response): Promise<void>;
    deleteEvidence(user: ActiveUser, id: string, evidenceId: string): Promise<{
        success: boolean;
    }>;
}
