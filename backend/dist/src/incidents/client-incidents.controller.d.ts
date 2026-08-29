import { Response } from 'express';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { IncidentsService } from './incidents.service';
export declare class ClientIncidentsController {
    private readonly incidentsService;
    constructor(incidentsService: IncidentsService);
    private getClientContext;
    findAll(user: ActiveUser): Promise<{
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
    findOne(user: ActiveUser, id: string): Promise<{
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
    downloadEvidence(user: ActiveUser, id: string, evidenceId: string, res: Response): Promise<void>;
}
