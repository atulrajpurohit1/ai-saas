import { Response } from 'express';
import { PatrolsService } from './patrols.service';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { StartPatrolRunDto } from './dto/start-patrol-run.dto';
import { ScanCheckpointDto } from './dto/scan-checkpoint.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
export declare class GuardPatrolsController {
    private readonly patrolsService;
    constructor(patrolsService: PatrolsService);
    private getGuardContext;
    getShiftPatrolRoutes(user: ActiveUser, shiftId: string): Promise<({
        checkpoints: ({
            checkpoint: {
                tenantId: string;
                id: string;
                siteId: string;
                name: string;
                description: string | null;
                status: string;
                createdAt: Date;
                updatedAt: Date;
                locationNote: string | null;
                qrCodeValue: string | null;
                latitude: number | null;
                longitude: number | null;
                geofenceRadiusMeters: number | null;
            };
        } & {
            id: string;
            sequenceOrder: number;
            patrolRouteId: string;
            checkpointId: string;
        })[];
    } & {
        tenantId: string;
        id: string;
        siteId: string;
        name: string;
        description: string | null;
        status: string;
        createdAt: Date;
        updatedAt: Date;
    })[]>;
    startPatrolRun(user: ActiveUser, shiftId: string, dto: StartPatrolRunDto): Promise<{
        patrolRoute: {
            checkpoints: ({
                checkpoint: {
                    tenantId: string;
                    id: string;
                    siteId: string;
                    name: string;
                    description: string | null;
                    status: string;
                    createdAt: Date;
                    updatedAt: Date;
                    locationNote: string | null;
                    qrCodeValue: string | null;
                    latitude: number | null;
                    longitude: number | null;
                    geofenceRadiusMeters: number | null;
                };
            } & {
                id: string;
                sequenceOrder: number;
                patrolRouteId: string;
                checkpointId: string;
            })[];
        } & {
            tenantId: string;
            id: string;
            siteId: string;
            name: string;
            description: string | null;
            status: string;
            createdAt: Date;
            updatedAt: Date;
        };
    } & {
        tenantId: string;
        guardId: string;
        id: string;
        status: string;
        createdAt: Date;
        updatedAt: Date;
        shiftId: string;
        patrolRouteId: string;
        startedAt: Date | null;
        completedAt: Date | null;
        lastLatitude: number | null;
        lastLongitude: number | null;
        lastAccuracyMeters: number | null;
        lastLocationAt: Date | null;
    }>;
    scanCheckpoint(user: ActiveUser, runId: string, checkpointId: string, dto: ScanCheckpointDto): Promise<{
        checkpoint: {
            tenantId: string;
            id: string;
            siteId: string;
            name: string;
            description: string | null;
            status: string;
            createdAt: Date;
            updatedAt: Date;
            locationNote: string | null;
            qrCodeValue: string | null;
            latitude: number | null;
            longitude: number | null;
            geofenceRadiusMeters: number | null;
        };
    } & {
        tenantId: string;
        guardId: string;
        id: string;
        status: string;
        createdAt: Date;
        checkpointId: string;
        patrolRunId: string;
        scannedAt: Date;
        notes: string | null;
        verificationStatus: string | null;
        distanceMeters: number | null;
        submittedLatitude: number | null;
        submittedLongitude: number | null;
    }>;
    updateLocation(user: ActiveUser, runId: string, dto: UpdateLocationDto): Promise<{
        id: string;
        lastLatitude: number | null;
        lastLongitude: number | null;
        lastAccuracyMeters: number | null;
        lastLocationAt: Date | null;
    }>;
    completePatrolRun(user: ActiveUser, runId: string): Promise<{
        events: ({
            checkpoint: {
                tenantId: string;
                id: string;
                siteId: string;
                name: string;
                description: string | null;
                status: string;
                createdAt: Date;
                updatedAt: Date;
                locationNote: string | null;
                qrCodeValue: string | null;
                latitude: number | null;
                longitude: number | null;
                geofenceRadiusMeters: number | null;
            };
        } & {
            tenantId: string;
            guardId: string;
            id: string;
            status: string;
            createdAt: Date;
            checkpointId: string;
            patrolRunId: string;
            scannedAt: Date;
            notes: string | null;
            verificationStatus: string | null;
            distanceMeters: number | null;
            submittedLatitude: number | null;
            submittedLongitude: number | null;
        })[];
    } & {
        tenantId: string;
        guardId: string;
        id: string;
        status: string;
        createdAt: Date;
        updatedAt: Date;
        shiftId: string;
        patrolRouteId: string;
        startedAt: Date | null;
        completedAt: Date | null;
        lastLatitude: number | null;
        lastLongitude: number | null;
        lastAccuracyMeters: number | null;
        lastLocationAt: Date | null;
    }>;
    getGuardPatrolRuns(user: ActiveUser): Promise<({
        patrolRoute: {
            id: string;
            name: string;
        };
        shift: {
            id: string;
            site: {
                id: string;
                name: string;
            };
            startTime: Date;
            endTime: Date;
        };
    } & {
        tenantId: string;
        guardId: string;
        id: string;
        status: string;
        createdAt: Date;
        updatedAt: Date;
        shiftId: string;
        patrolRouteId: string;
        startedAt: Date | null;
        completedAt: Date | null;
        lastLatitude: number | null;
        lastLongitude: number | null;
        lastAccuracyMeters: number | null;
        lastLocationAt: Date | null;
    })[]>;
    getGuardPatrolRun(user: ActiveUser, runId: string): Promise<{
        patrolRoute: {
            id: string;
            name: string;
            checkpoints: ({
                checkpoint: {
                    tenantId: string;
                    id: string;
                    siteId: string;
                    name: string;
                    description: string | null;
                    status: string;
                    createdAt: Date;
                    updatedAt: Date;
                    locationNote: string | null;
                    qrCodeValue: string | null;
                    latitude: number | null;
                    longitude: number | null;
                    geofenceRadiusMeters: number | null;
                };
            } & {
                id: string;
                sequenceOrder: number;
                patrolRouteId: string;
                checkpointId: string;
            })[];
        };
        shift: {
            id: string;
            site: {
                id: string;
                name: string;
            };
            startTime: Date;
            endTime: Date;
        };
        guard: {
            id: string;
            name: string;
        };
        events: ({
            checkpoint: {
                tenantId: string;
                id: string;
                siteId: string;
                name: string;
                description: string | null;
                status: string;
                createdAt: Date;
                updatedAt: Date;
                locationNote: string | null;
                qrCodeValue: string | null;
                latitude: number | null;
                longitude: number | null;
                geofenceRadiusMeters: number | null;
            };
            evidence: {
                id: string;
                createdAt: Date;
                mediaType: string;
                mimeType: string;
                fileName: string;
                fileSizeBytes: number;
            }[];
        } & {
            tenantId: string;
            guardId: string;
            id: string;
            status: string;
            createdAt: Date;
            checkpointId: string;
            patrolRunId: string;
            scannedAt: Date;
            notes: string | null;
            verificationStatus: string | null;
            distanceMeters: number | null;
            submittedLatitude: number | null;
            submittedLongitude: number | null;
        })[];
    } & {
        tenantId: string;
        guardId: string;
        id: string;
        status: string;
        createdAt: Date;
        updatedAt: Date;
        shiftId: string;
        patrolRouteId: string;
        startedAt: Date | null;
        completedAt: Date | null;
        lastLatitude: number | null;
        lastLongitude: number | null;
        lastAccuracyMeters: number | null;
        lastLocationAt: Date | null;
    }>;
    uploadCheckpointEvidence(user: ActiveUser, runId: string, eventId: string, file: Express.Multer.File): Promise<{
        id: string;
        patrolEventId: string;
        patrolRunId: string;
        guardId: string;
        mediaType: string;
        mimeType: string;
        fileName: string;
        fileSizeBytes: number;
        uploadedById: string | null;
        createdAt: Date;
    }>;
    listCheckpointEvidence(user: ActiveUser, runId: string, eventId: string): Promise<{
        id: string;
        patrolEventId: string;
        patrolRunId: string;
        guardId: string;
        mediaType: string;
        mimeType: string;
        fileName: string;
        fileSizeBytes: number;
        uploadedById: string | null;
        createdAt: Date;
    }[]>;
    downloadCheckpointEvidence(user: ActiveUser, runId: string, eventId: string, evidenceId: string, res: Response): Promise<void>;
}
