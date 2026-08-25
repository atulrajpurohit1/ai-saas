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
    startPatrolRun(user: ActiveUser, shiftId: string, dto: StartPatrolRunDto): Promise<{
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
    scanCheckpoint(user: ActiveUser, runId: string, checkpointId: string, dto: ScanCheckpointDto): Promise<{
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
    getGuardPatrolRuns(user: ActiveUser): Promise<({
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
}
