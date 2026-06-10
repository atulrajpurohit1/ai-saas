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
        status: string;
        description: string | null;
        siteId: string;
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
        description: string | null;
        siteId: string;
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
        description: string | null;
        siteId: string;
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
        description: string | null;
        siteId: string;
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
        description: string | null;
        siteId: string;
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
        description: string | null;
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
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        status: string;
        description: string | null;
        siteId: string;
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
    }) | null>;
    findAllPatrolRuns(user: ActiveUser): Promise<({
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
            patrolRunId: string;
            checkpointId: string;
            scannedAt: Date;
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
    getShiftPatrolRoutes(tenantId: string, guardId: string, shiftId: string): Promise<({
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
    startPatrolRun(tenantId: string, guardId: string, shiftId: string, dto: StartPatrolRunDto): Promise<{
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
    scanCheckpoint(tenantId: string, guardId: string, runId: string, checkpointId: string, dto?: ScanCheckpointDto): Promise<{
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
        patrolRunId: string;
        checkpointId: string;
        scannedAt: Date;
    }>;
    completePatrolRun(tenantId: string, guardId: string, runId: string): Promise<{
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
            patrolRunId: string;
            checkpointId: string;
            scannedAt: Date;
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
    })[]>;
}
