import { Response } from 'express';
import { PatrolsService } from './patrols.service';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { CreateCheckpointDto } from './dto/create-checkpoint.dto';
import { UpdateCheckpointDto } from './dto/update-checkpoint.dto';
import { CreatePatrolRouteDto } from './dto/create-patrol-route.dto';
import { UpdatePatrolRouteDto } from './dto/update-patrol-route.dto';
import { AttachCheckpointsDto } from './dto/attach-checkpoints.dto';
export declare class PatrolsController {
    private readonly patrolsService;
    constructor(patrolsService: PatrolsService);
    createCheckpoint(user: ActiveUser, dto: CreateCheckpointDto): Promise<{
        site: {
            id: string;
            name: string;
        };
    } & {
        id: string;
        name: string;
        description: string | null;
        locationNote: string | null;
        qrCodeValue: string | null;
        latitude: number | null;
        longitude: number | null;
        geofenceRadiusMeters: number | null;
        status: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        siteId: string;
    }>;
    findAllCheckpoints(user: ActiveUser, siteId?: string): Promise<({
        site: {
            id: string;
            name: string;
        };
    } & {
        id: string;
        name: string;
        description: string | null;
        locationNote: string | null;
        qrCodeValue: string | null;
        latitude: number | null;
        longitude: number | null;
        geofenceRadiusMeters: number | null;
        status: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        siteId: string;
    })[]>;
    updateCheckpoint(user: ActiveUser, id: string, dto: UpdateCheckpointDto): Promise<{
        site: {
            id: string;
            name: string;
        };
    } & {
        id: string;
        name: string;
        description: string | null;
        locationNote: string | null;
        qrCodeValue: string | null;
        latitude: number | null;
        longitude: number | null;
        geofenceRadiusMeters: number | null;
        status: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        siteId: string;
    }>;
    createPatrolRoute(user: ActiveUser, dto: CreatePatrolRouteDto): Promise<{
        site: {
            id: string;
            name: string;
        };
    } & {
        id: string;
        name: string;
        description: string | null;
        status: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        siteId: string;
    }>;
    findAllPatrolRoutes(user: ActiveUser, siteId?: string): Promise<({
        site: {
            id: string;
            name: string;
        };
        checkpoints: {
            id: string;
        }[];
    } & {
        id: string;
        name: string;
        description: string | null;
        status: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        siteId: string;
    })[]>;
    findPatrolRoute(user: ActiveUser, id: string): Promise<{
        site: {
            id: string;
            name: string;
        };
        checkpoints: ({
            checkpoint: {
                id: string;
                name: string;
                description: string | null;
                locationNote: string | null;
                qrCodeValue: string | null;
                latitude: number | null;
                longitude: number | null;
                geofenceRadiusMeters: number | null;
                status: string;
                createdAt: Date;
                updatedAt: Date;
                tenantId: string;
                siteId: string;
            };
        } & {
            id: string;
            patrolRouteId: string;
            checkpointId: string;
            sequenceOrder: number;
        })[];
    } & {
        id: string;
        name: string;
        description: string | null;
        status: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        siteId: string;
    }>;
    updatePatrolRoute(user: ActiveUser, id: string, dto: UpdatePatrolRouteDto): Promise<{
        site: {
            id: string;
            name: string;
        };
    } & {
        id: string;
        name: string;
        description: string | null;
        status: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        siteId: string;
    }>;
    attachCheckpoints(user: ActiveUser, routeId: string, dto: AttachCheckpointsDto): Promise<({
        checkpoints: ({
            checkpoint: {
                id: string;
                name: string;
                description: string | null;
                locationNote: string | null;
                qrCodeValue: string | null;
                latitude: number | null;
                longitude: number | null;
                geofenceRadiusMeters: number | null;
                status: string;
                createdAt: Date;
                updatedAt: Date;
                tenantId: string;
                siteId: string;
            };
        } & {
            id: string;
            patrolRouteId: string;
            checkpointId: string;
            sequenceOrder: number;
        })[];
    } & {
        id: string;
        name: string;
        description: string | null;
        status: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        siteId: string;
    }) | null>;
    findAllPatrolRuns(user: ActiveUser, status?: string): Promise<({
        patrolRoute: {
            id: string;
            name: string;
        };
        guard: {
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
        id: string;
        status: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        patrolRouteId: string;
        shiftId: string;
        guardId: string;
        startedAt: Date | null;
        completedAt: Date | null;
        lastLatitude: number | null;
        lastLongitude: number | null;
        lastAccuracyMeters: number | null;
        lastLocationAt: Date | null;
    })[]>;
    getPatrolOverview(user: ActiveUser): Promise<{
        generatedAt: Date;
        summary: {
            activeRuns: number;
            guardsOnPatrol: number;
            completedToday: number;
            checkpointsScannedToday: number;
            missedCheckpointsToday: number;
            geofenceFailuresToday: number;
        };
        activeRuns: {
            id: string;
            status: string;
            active: boolean;
            startedAt: Date | null;
            completedAt: Date | null;
            guard: {
                id: string;
                name: string;
            };
            route: {
                id: string;
                name: string;
            } | null;
            site: {
                id: string;
                name: string;
            };
            shift: {
                id: string;
                startTime: Date;
                endTime: Date;
            } | null;
            checkpoints: {
                scanned: number;
                total: number;
                missed: number;
            };
            geofenceFailures: number;
            lastScanAt: Date | null;
            location: {
                latitude: number | null;
                longitude: number | null;
                accuracyMeters: number | null;
                at: Date | null;
            } | null;
        }[];
        completedToday: {
            id: string;
            status: string;
            active: boolean;
            startedAt: Date | null;
            completedAt: Date | null;
            guard: {
                id: string;
                name: string;
            };
            route: {
                id: string;
                name: string;
            } | null;
            site: {
                id: string;
                name: string;
            };
            shift: {
                id: string;
                startTime: Date;
                endTime: Date;
            } | null;
            checkpoints: {
                scanned: number;
                total: number;
                missed: number;
            };
            geofenceFailures: number;
            lastScanAt: Date | null;
            location: {
                latitude: number | null;
                longitude: number | null;
                accuracyMeters: number | null;
                at: Date | null;
            } | null;
        }[];
    }>;
    findPatrolRun(user: ActiveUser, id: string): Promise<{
        patrolRoute: {
            id: string;
            name: string;
        };
        guard: {
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
        events: ({
            checkpoint: {
                id: string;
                name: string;
                description: string | null;
                locationNote: string | null;
                qrCodeValue: string | null;
                latitude: number | null;
                longitude: number | null;
                geofenceRadiusMeters: number | null;
                status: string;
                createdAt: Date;
                updatedAt: Date;
                tenantId: string;
                siteId: string;
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
            id: string;
            status: string;
            createdAt: Date;
            tenantId: string;
            checkpointId: string;
            guardId: string;
            scannedAt: Date;
            patrolRunId: string;
            notes: string | null;
            verificationStatus: string | null;
            distanceMeters: number | null;
            submittedLatitude: number | null;
            submittedLongitude: number | null;
        })[];
    } & {
        id: string;
        status: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        patrolRouteId: string;
        shiftId: string;
        guardId: string;
        startedAt: Date | null;
        completedAt: Date | null;
        lastLatitude: number | null;
        lastLongitude: number | null;
        lastAccuracyMeters: number | null;
        lastLocationAt: Date | null;
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
