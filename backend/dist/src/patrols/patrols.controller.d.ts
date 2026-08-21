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
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        status: string;
        siteId: string;
        description: string | null;
        locationNote: string | null;
        qrCodeValue: string | null;
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
        status: string;
        siteId: string;
        description: string | null;
        locationNote: string | null;
        qrCodeValue: string | null;
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
        status: string;
        siteId: string;
        description: string | null;
        locationNote: string | null;
        qrCodeValue: string | null;
    }>;
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
        status: string;
        siteId: string;
        description: string | null;
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
        status: string;
        siteId: string;
        description: string | null;
    })[]>;
    findPatrolRoute(user: ActiveUser, id: string): Promise<{
        checkpoints: ({
            checkpoint: {
                id: string;
                name: string;
                createdAt: Date;
                updatedAt: Date;
                tenantId: string;
                status: string;
                siteId: string;
                description: string | null;
                locationNote: string | null;
                qrCodeValue: string | null;
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
        status: string;
        siteId: string;
        description: string | null;
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
        status: string;
        siteId: string;
        description: string | null;
    }>;
    attachCheckpoints(user: ActiveUser, routeId: string, dto: AttachCheckpointsDto): Promise<({
        checkpoints: ({
            checkpoint: {
                id: string;
                name: string;
                createdAt: Date;
                updatedAt: Date;
                tenantId: string;
                status: string;
                siteId: string;
                description: string | null;
                locationNote: string | null;
                qrCodeValue: string | null;
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
        status: string;
        siteId: string;
        description: string | null;
    }) | null>;
    findAllPatrolRuns(user: ActiveUser): Promise<({
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
    findPatrolRun(user: ActiveUser, id: string): Promise<{
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
                status: string;
                siteId: string;
                description: string | null;
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
}
