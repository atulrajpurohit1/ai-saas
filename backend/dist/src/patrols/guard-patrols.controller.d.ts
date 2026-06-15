import { PatrolsService } from './patrols.service';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { StartPatrolRunDto } from './dto/start-patrol-run.dto';
import { ScanCheckpointDto } from './dto/scan-checkpoint.dto';
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
                status: string;
                description: string | null;
                siteId: string;
                locationNote: string | null;
                qrCodeValue: string | null;
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
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        status: string;
        description: string | null;
        siteId: string;
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
                    status: string;
                    description: string | null;
                    siteId: string;
                    locationNote: string | null;
                    qrCodeValue: string | null;
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
            createdAt: Date;
            updatedAt: Date;
            tenantId: string;
            status: string;
            description: string | null;
            siteId: string;
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
    }>;
    scanCheckpoint(user: ActiveUser, runId: string, checkpointId: string, dto: ScanCheckpointDto): Promise<{
        checkpoint: {
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            tenantId: string;
            status: string;
            description: string | null;
            siteId: string;
            locationNote: string | null;
            qrCodeValue: string | null;
        };
    } & {
        id: string;
        createdAt: Date;
        notes: string | null;
        tenantId: string;
        status: string;
        guardId: string;
        checkpointId: string;
        scannedAt: Date;
        patrolRunId: string;
    }>;
    completePatrolRun(user: ActiveUser, runId: string): Promise<{
        events: ({
            checkpoint: {
                id: string;
                name: string;
                createdAt: Date;
                updatedAt: Date;
                tenantId: string;
                status: string;
                description: string | null;
                siteId: string;
                locationNote: string | null;
                qrCodeValue: string | null;
            };
        } & {
            id: string;
            createdAt: Date;
            notes: string | null;
            tenantId: string;
            status: string;
            guardId: string;
            checkpointId: string;
            scannedAt: Date;
            patrolRunId: string;
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
    })[]>;
}
