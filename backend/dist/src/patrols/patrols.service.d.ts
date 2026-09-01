import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { CreateCheckpointDto } from './dto/create-checkpoint.dto';
import { UpdateCheckpointDto } from './dto/update-checkpoint.dto';
import { CreatePatrolRouteDto } from './dto/create-patrol-route.dto';
import { UpdatePatrolRouteDto } from './dto/update-patrol-route.dto';
import { AttachCheckpointsDto } from './dto/attach-checkpoints.dto';
import { StartPatrolRunDto } from './dto/start-patrol-run.dto';
import { ScanCheckpointDto } from './dto/scan-checkpoint.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
export declare class PatrolsService {
    private prisma;
    private auditService;
    constructor(prisma: PrismaService, auditService: AuditService);
    createCheckpoint(user: ActiveUser, dto: CreateCheckpointDto): Promise<{
        site: {
            id: string;
            name: string;
        };
    } & {
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        siteId: string;
        description: string | null;
        locationNote: string | null;
        qrCodeValue: string | null;
        latitude: number | null;
        longitude: number | null;
        geofenceRadiusMeters: number | null;
        status: string;
    }>;
    findAllCheckpoints(user: ActiveUser, siteId?: string): Promise<({
        site: {
            id: string;
            name: string;
        };
    } & {
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        siteId: string;
        description: string | null;
        locationNote: string | null;
        qrCodeValue: string | null;
        latitude: number | null;
        longitude: number | null;
        geofenceRadiusMeters: number | null;
        status: string;
    })[]>;
    updateCheckpoint(user: ActiveUser, id: string, dto: UpdateCheckpointDto): Promise<{
        site: {
            id: string;
            name: string;
        };
    } & {
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        siteId: string;
        description: string | null;
        locationNote: string | null;
        qrCodeValue: string | null;
        latitude: number | null;
        longitude: number | null;
        geofenceRadiusMeters: number | null;
        status: string;
    }>;
    private resolveGeofenceForCreate;
    private resolveGeofenceForUpdate;
    createPatrolRoute(user: ActiveUser, dto: CreatePatrolRouteDto): Promise<{
        site: {
            id: string;
            name: string;
        };
    } & {
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        siteId: string;
        description: string | null;
        status: string;
    }>;
    findAllPatrolRoutes(user: ActiveUser, siteId?: string): Promise<({
        checkpoints: {
            id: string;
        }[];
        site: {
            id: string;
            name: string;
        };
    } & {
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        siteId: string;
        description: string | null;
        status: string;
    })[]>;
    findPatrolRoute(user: ActiveUser, id: string): Promise<{
        checkpoints: ({
            checkpoint: {
                id: string;
                name: string;
                createdAt: Date;
                updatedAt: Date;
                tenantId: string;
                siteId: string;
                description: string | null;
                locationNote: string | null;
                qrCodeValue: string | null;
                latitude: number | null;
                longitude: number | null;
                geofenceRadiusMeters: number | null;
                status: string;
            };
        } & {
            id: string;
            checkpointId: string;
            patrolRouteId: string;
            sequenceOrder: number;
        })[];
        site: {
            id: string;
            name: string;
        };
    } & {
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        siteId: string;
        description: string | null;
        status: string;
    }>;
    updatePatrolRoute(user: ActiveUser, id: string, dto: UpdatePatrolRouteDto): Promise<{
        site: {
            id: string;
            name: string;
        };
    } & {
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        siteId: string;
        description: string | null;
        status: string;
    }>;
    attachCheckpoints(user: ActiveUser, routeId: string, dto: AttachCheckpointsDto): Promise<({
        checkpoints: ({
            checkpoint: {
                id: string;
                name: string;
                createdAt: Date;
                updatedAt: Date;
                tenantId: string;
                siteId: string;
                description: string | null;
                locationNote: string | null;
                qrCodeValue: string | null;
                latitude: number | null;
                longitude: number | null;
                geofenceRadiusMeters: number | null;
                status: string;
            };
        } & {
            id: string;
            checkpointId: string;
            patrolRouteId: string;
            sequenceOrder: number;
        })[];
    } & {
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        siteId: string;
        description: string | null;
        status: string;
    }) | null>;
    findAllPatrolRuns(user: ActiveUser, status?: string): Promise<({
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
        patrolRoute: {
            id: string;
            name: string;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        status: string;
        guardId: string;
        shiftId: string;
        patrolRouteId: string;
        startedAt: Date | null;
        completedAt: Date | null;
        lastLatitude: number | null;
        lastLongitude: number | null;
        lastAccuracyMeters: number | null;
        lastLocationAt: Date | null;
    })[]>;
    findPatrolRun(user: ActiveUser, id: string): Promise<{
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
        patrolRoute: {
            id: string;
            name: string;
        };
        events: ({
            checkpoint: {
                id: string;
                name: string;
                createdAt: Date;
                updatedAt: Date;
                tenantId: string;
                siteId: string;
                description: string | null;
                locationNote: string | null;
                qrCodeValue: string | null;
                latitude: number | null;
                longitude: number | null;
                geofenceRadiusMeters: number | null;
                status: string;
            };
        } & {
            id: string;
            createdAt: Date;
            notes: string | null;
            tenantId: string;
            status: string;
            patrolRunId: string;
            checkpointId: string;
            guardId: string;
            scannedAt: Date;
            verificationStatus: string | null;
            distanceMeters: number | null;
            submittedLatitude: number | null;
            submittedLongitude: number | null;
        })[];
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        status: string;
        guardId: string;
        shiftId: string;
        patrolRouteId: string;
        startedAt: Date | null;
        completedAt: Date | null;
        lastLatitude: number | null;
        lastLongitude: number | null;
        lastAccuracyMeters: number | null;
        lastLocationAt: Date | null;
    }>;
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
    getShiftPatrolRoutes(tenantId: string, guardId: string, shiftId: string): Promise<({
        checkpoints: ({
            checkpoint: {
                id: string;
                name: string;
                createdAt: Date;
                updatedAt: Date;
                tenantId: string;
                siteId: string;
                description: string | null;
                locationNote: string | null;
                qrCodeValue: string | null;
                latitude: number | null;
                longitude: number | null;
                geofenceRadiusMeters: number | null;
                status: string;
            };
        } & {
            id: string;
            checkpointId: string;
            patrolRouteId: string;
            sequenceOrder: number;
        })[];
    } & {
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        siteId: string;
        description: string | null;
        status: string;
    })[]>;
    startPatrolRun(tenantId: string, guardId: string, shiftId: string, dto: StartPatrolRunDto): Promise<{
        patrolRoute: {
            checkpoints: ({
                checkpoint: {
                    id: string;
                    name: string;
                    createdAt: Date;
                    updatedAt: Date;
                    tenantId: string;
                    siteId: string;
                    description: string | null;
                    locationNote: string | null;
                    qrCodeValue: string | null;
                    latitude: number | null;
                    longitude: number | null;
                    geofenceRadiusMeters: number | null;
                    status: string;
                };
            } & {
                id: string;
                checkpointId: string;
                patrolRouteId: string;
                sequenceOrder: number;
            })[];
        } & {
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            tenantId: string;
            siteId: string;
            description: string | null;
            status: string;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        status: string;
        guardId: string;
        shiftId: string;
        patrolRouteId: string;
        startedAt: Date | null;
        completedAt: Date | null;
        lastLatitude: number | null;
        lastLongitude: number | null;
        lastAccuracyMeters: number | null;
        lastLocationAt: Date | null;
    }>;
    scanCheckpoint(tenantId: string, guardId: string, runId: string, checkpointId: string, dto?: ScanCheckpointDto): Promise<{
        checkpoint: {
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            tenantId: string;
            siteId: string;
            description: string | null;
            locationNote: string | null;
            qrCodeValue: string | null;
            latitude: number | null;
            longitude: number | null;
            geofenceRadiusMeters: number | null;
            status: string;
        };
    } & {
        id: string;
        createdAt: Date;
        notes: string | null;
        tenantId: string;
        status: string;
        patrolRunId: string;
        checkpointId: string;
        guardId: string;
        scannedAt: Date;
        verificationStatus: string | null;
        distanceMeters: number | null;
        submittedLatitude: number | null;
        submittedLongitude: number | null;
    }>;
    private verifyCheckpointLocation;
    completePatrolRun(tenantId: string, guardId: string, runId: string): Promise<{
        events: ({
            checkpoint: {
                id: string;
                name: string;
                createdAt: Date;
                updatedAt: Date;
                tenantId: string;
                siteId: string;
                description: string | null;
                locationNote: string | null;
                qrCodeValue: string | null;
                latitude: number | null;
                longitude: number | null;
                geofenceRadiusMeters: number | null;
                status: string;
            };
        } & {
            id: string;
            createdAt: Date;
            notes: string | null;
            tenantId: string;
            status: string;
            patrolRunId: string;
            checkpointId: string;
            guardId: string;
            scannedAt: Date;
            verificationStatus: string | null;
            distanceMeters: number | null;
            submittedLatitude: number | null;
            submittedLongitude: number | null;
        })[];
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        status: string;
        guardId: string;
        shiftId: string;
        patrolRouteId: string;
        startedAt: Date | null;
        completedAt: Date | null;
        lastLatitude: number | null;
        lastLongitude: number | null;
        lastAccuracyMeters: number | null;
        lastLocationAt: Date | null;
    }>;
    updateLocation(tenantId: string, guardId: string, runId: string, dto: UpdateLocationDto): Promise<{
        id: string;
        lastLatitude: number | null;
        lastLongitude: number | null;
        lastAccuracyMeters: number | null;
        lastLocationAt: Date | null;
    }>;
    getGuardPatrolRuns(tenantId: string, guardId: string): Promise<({
        shift: {
            id: string;
            site: {
                id: string;
                name: string;
            };
            startTime: Date;
            endTime: Date;
        };
        patrolRoute: {
            id: string;
            name: string;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        status: string;
        guardId: string;
        shiftId: string;
        patrolRouteId: string;
        startedAt: Date | null;
        completedAt: Date | null;
        lastLatitude: number | null;
        lastLongitude: number | null;
        lastAccuracyMeters: number | null;
        lastLocationAt: Date | null;
    })[]>;
    getLiveSiteStatusForClient(tenantId: string, clientId: string): Promise<{
        site: {
            id: string;
            name: string;
            address: string;
        };
        guardsOnSite: {
            guardId: string;
            guardName: string;
            shiftId: string;
            patrolRoute: {
                id: string;
                name: string;
            } | null;
            location: {
                latitude: number;
                longitude: number;
                accuracyMeters: number | null;
                capturedAt: Date | null;
            } | null;
        }[];
    }[]>;
}
