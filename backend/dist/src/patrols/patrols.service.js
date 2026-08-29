"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PatrolsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const audit_service_1 = require("../audit/audit.service");
const branch_scope_1 = require("../branches/branch-scope");
const geo_util_1 = require("../common/geo.util");
const checkpoint_verification_constants_1 = require("./checkpoint-verification.constants");
let PatrolsService = class PatrolsService {
    prisma;
    auditService;
    constructor(prisma, auditService) {
        this.prisma = prisma;
        this.auditService = auditService;
    }
    async createCheckpoint(user, dto) {
        const site = await this.prisma.site.findFirst({
            where: { id: dto.site_id, tenantId: user.tenantId, ...(0, branch_scope_1.branchWhere)(user) },
        });
        if (!site) {
            throw new common_1.NotFoundException('Site not found');
        }
        const geofence = this.resolveGeofenceForCreate(dto);
        const checkpoint = await this.prisma.checkpoint.create({
            data: {
                tenantId: user.tenantId,
                siteId: dto.site_id,
                name: dto.name,
                description: dto.description,
                locationNote: dto.location_note,
                qrCodeValue: dto.qr_code_value,
                status: 'active',
                latitude: geofence.latitude,
                longitude: geofence.longitude,
                geofenceRadiusMeters: geofence.geofenceRadiusMeters,
            },
            include: {
                site: { select: { id: true, name: true } },
            },
        });
        await this.auditService.log({
            tenantId: user.tenantId,
            userId: user.sub,
            action: 'CHECKPOINT_CREATED',
            entityType: 'Checkpoint',
            entityId: checkpoint.id,
            details: `Checkpoint "${checkpoint.name}" created for site "${site.name}"`,
        });
        return checkpoint;
    }
    async findAllCheckpoints(user, siteId) {
        const siteFilter = siteId
            ? { id: siteId, tenantId: user.tenantId, ...(0, branch_scope_1.branchWhere)(user) }
            : { tenantId: user.tenantId, ...(0, branch_scope_1.branchWhere)(user) };
        return this.prisma.checkpoint.findMany({
            where: {
                tenantId: user.tenantId,
                site: siteFilter,
            },
            include: {
                site: { select: { id: true, name: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
    }
    async updateCheckpoint(user, id, dto) {
        const checkpoint = await this.prisma.checkpoint.findFirst({
            where: { id, tenantId: user.tenantId, site: { ...(0, branch_scope_1.branchWhere)(user) } },
        });
        if (!checkpoint) {
            throw new common_1.NotFoundException('Checkpoint not found');
        }
        const geofenceUpdate = this.resolveGeofenceForUpdate(checkpoint, dto);
        const updated = await this.prisma.checkpoint.update({
            where: { id },
            data: {
                ...(dto.name !== undefined ? { name: dto.name } : {}),
                ...(dto.description !== undefined
                    ? { description: dto.description }
                    : {}),
                ...(dto.location_note !== undefined
                    ? { locationNote: dto.location_note }
                    : {}),
                ...(dto.qr_code_value !== undefined
                    ? { qrCodeValue: dto.qr_code_value }
                    : {}),
                ...(dto.status !== undefined ? { status: dto.status } : {}),
                ...geofenceUpdate,
            },
            include: {
                site: { select: { id: true, name: true } },
            },
        });
        await this.auditService.log({
            tenantId: user.tenantId,
            userId: user.sub,
            action: 'CHECKPOINT_UPDATED',
            entityType: 'Checkpoint',
            entityId: checkpoint.id,
            details: `Checkpoint "${checkpoint.name}" updated`,
        });
        return updated;
    }
    resolveGeofenceForCreate(dto) {
        const hasLatitude = dto.latitude !== undefined;
        const hasLongitude = dto.longitude !== undefined;
        if (hasLatitude !== hasLongitude) {
            throw new common_1.BadRequestException('Both latitude and longitude are required to configure a checkpoint geofence');
        }
        if (!hasLatitude) {
            return { latitude: null, longitude: null, geofenceRadiusMeters: null };
        }
        return {
            latitude: dto.latitude,
            longitude: dto.longitude,
            geofenceRadiusMeters: dto.geofence_radius_meters ?? checkpoint_verification_constants_1.DEFAULT_GEOFENCE_RADIUS_METERS,
        };
    }
    resolveGeofenceForUpdate(checkpoint, dto) {
        if (dto.clear_geofence) {
            return { latitude: null, longitude: null, geofenceRadiusMeters: null };
        }
        const touchesGeofence = dto.latitude !== undefined ||
            dto.longitude !== undefined ||
            dto.geofence_radius_meters !== undefined;
        if (!touchesGeofence) {
            return {};
        }
        const latitude = dto.latitude ?? checkpoint.latitude;
        const longitude = dto.longitude ?? checkpoint.longitude;
        if ((latitude === null) !== (longitude === null)) {
            throw new common_1.BadRequestException('Both latitude and longitude are required to configure a checkpoint geofence');
        }
        if (latitude === null || longitude === null) {
            return { latitude: null, longitude: null, geofenceRadiusMeters: null };
        }
        return {
            latitude,
            longitude,
            geofenceRadiusMeters: dto.geofence_radius_meters ??
                checkpoint.geofenceRadiusMeters ??
                checkpoint_verification_constants_1.DEFAULT_GEOFENCE_RADIUS_METERS,
        };
    }
    async createPatrolRoute(user, dto) {
        const site = await this.prisma.site.findFirst({
            where: { id: dto.site_id, tenantId: user.tenantId, ...(0, branch_scope_1.branchWhere)(user) },
        });
        if (!site) {
            throw new common_1.NotFoundException('Site not found');
        }
        const route = await this.prisma.patrolRoute.create({
            data: {
                tenantId: user.tenantId,
                siteId: dto.site_id,
                name: dto.name,
                description: dto.description,
                status: 'active',
            },
            include: {
                site: { select: { id: true, name: true } },
            },
        });
        await this.auditService.log({
            tenantId: user.tenantId,
            userId: user.sub,
            action: 'PATROL_ROUTE_CREATED',
            entityType: 'PatrolRoute',
            entityId: route.id,
            details: `Patrol route "${route.name}" created for site "${site.name}"`,
        });
        return route;
    }
    async findAllPatrolRoutes(user, siteId) {
        const siteFilter = siteId
            ? { id: siteId, tenantId: user.tenantId, ...(0, branch_scope_1.branchWhere)(user) }
            : { tenantId: user.tenantId, ...(0, branch_scope_1.branchWhere)(user) };
        return this.prisma.patrolRoute.findMany({
            where: {
                tenantId: user.tenantId,
                site: siteFilter,
            },
            include: {
                site: { select: { id: true, name: true } },
                checkpoints: {
                    select: { id: true },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    }
    async findPatrolRoute(user, id) {
        const route = await this.prisma.patrolRoute.findFirst({
            where: { id, tenantId: user.tenantId, site: { ...(0, branch_scope_1.branchWhere)(user) } },
            include: {
                site: { select: { id: true, name: true } },
                checkpoints: {
                    orderBy: { sequenceOrder: 'asc' },
                    include: {
                        checkpoint: true,
                    },
                },
            },
        });
        if (!route) {
            throw new common_1.NotFoundException('Patrol route not found');
        }
        return route;
    }
    async updatePatrolRoute(user, id, dto) {
        const route = await this.prisma.patrolRoute.findFirst({
            where: { id, tenantId: user.tenantId, site: { ...(0, branch_scope_1.branchWhere)(user) } },
        });
        if (!route) {
            throw new common_1.NotFoundException('Patrol route not found');
        }
        const updated = await this.prisma.patrolRoute.update({
            where: { id },
            data: {
                ...(dto.name !== undefined ? { name: dto.name } : {}),
                ...(dto.description !== undefined
                    ? { description: dto.description }
                    : {}),
                ...(dto.status !== undefined ? { status: dto.status } : {}),
            },
            include: {
                site: { select: { id: true, name: true } },
            },
        });
        await this.auditService.log({
            tenantId: user.tenantId,
            userId: user.sub,
            action: 'PATROL_ROUTE_UPDATED',
            entityType: 'PatrolRoute',
            entityId: route.id,
            details: `Patrol route "${route.name}" updated`,
        });
        return updated;
    }
    async attachCheckpoints(user, routeId, dto) {
        const route = await this.prisma.patrolRoute.findFirst({
            where: {
                id: routeId,
                tenantId: user.tenantId,
                site: { ...(0, branch_scope_1.branchWhere)(user) },
            },
        });
        if (!route) {
            throw new common_1.NotFoundException('Patrol route not found');
        }
        const checkpointIds = dto.checkpoints.map((cp) => cp.checkpoint_id);
        const validCheckpoints = await this.prisma.checkpoint.findMany({
            where: {
                id: { in: checkpointIds },
                tenantId: user.tenantId,
                siteId: route.siteId,
            },
        });
        if (validCheckpoints.length !== checkpointIds.length) {
            throw new common_1.BadRequestException('Some checkpoints do not exist or do not belong to this site');
        }
        const result = await this.prisma.$transaction(async (tx) => {
            await tx.patrolRouteCheckpoint.deleteMany({
                where: { patrolRouteId: routeId },
            });
            if (dto.checkpoints.length > 0) {
                await tx.patrolRouteCheckpoint.createMany({
                    data: dto.checkpoints.map((cp) => ({
                        patrolRouteId: routeId,
                        checkpointId: cp.checkpoint_id,
                        sequenceOrder: cp.sequence_order,
                    })),
                });
            }
            return tx.patrolRoute.findUnique({
                where: { id: routeId },
                include: {
                    checkpoints: {
                        orderBy: { sequenceOrder: 'asc' },
                        include: { checkpoint: true },
                    },
                },
            });
        });
        await this.auditService.log({
            tenantId: user.tenantId,
            userId: user.sub,
            action: 'PATROL_ROUTE_CHECKPOINTS_ATTACHED',
            entityType: 'PatrolRoute',
            entityId: route.id,
            details: `Attached ${dto.checkpoints.length} checkpoints to patrol route "${route.name}"`,
        });
        return result;
    }
    async findAllPatrolRuns(user, status) {
        return this.prisma.patrolRun.findMany({
            where: {
                tenantId: user.tenantId,
                shift: { ...(0, branch_scope_1.branchWhere)(user) },
                ...(status ? { status } : {}),
            },
            include: {
                patrolRoute: {
                    select: { id: true, name: true },
                },
                guard: {
                    select: { id: true, name: true },
                },
                shift: {
                    select: {
                        id: true,
                        startTime: true,
                        endTime: true,
                        site: { select: { id: true, name: true } },
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    }
    async findPatrolRun(user, id) {
        const run = await this.prisma.patrolRun.findFirst({
            where: {
                id,
                tenantId: user.tenantId,
                shift: { ...(0, branch_scope_1.branchWhere)(user) },
            },
            include: {
                patrolRoute: {
                    select: { id: true, name: true },
                },
                guard: {
                    select: { id: true, name: true },
                },
                shift: {
                    select: {
                        id: true,
                        startTime: true,
                        endTime: true,
                        site: { select: { id: true, name: true } },
                    },
                },
                events: {
                    orderBy: { scannedAt: 'asc' },
                    include: {
                        checkpoint: true,
                    },
                },
            },
        });
        if (!run) {
            throw new common_1.NotFoundException('Patrol run not found');
        }
        return run;
    }
    async getShiftPatrolRoutes(tenantId, guardId, shiftId) {
        const assignment = await this.prisma.assignment.findFirst({
            where: {
                shiftId,
                guardId,
                shift: { tenantId },
            },
            include: {
                shift: true,
            },
        });
        if (!assignment) {
            throw new common_1.ForbiddenException('You are not assigned to this shift');
        }
        return this.prisma.patrolRoute.findMany({
            where: {
                tenantId,
                siteId: assignment.shift.siteId,
                status: 'active',
            },
            include: {
                checkpoints: {
                    orderBy: { sequenceOrder: 'asc' },
                    include: { checkpoint: true },
                },
            },
        });
    }
    async startPatrolRun(tenantId, guardId, shiftId, dto) {
        const assignment = await this.prisma.assignment.findFirst({
            where: {
                shiftId,
                guardId,
                shift: { tenantId },
            },
            include: {
                shift: true,
            },
        });
        if (!assignment) {
            throw new common_1.ForbiddenException('You are not assigned to this shift');
        }
        const route = await this.prisma.patrolRoute.findFirst({
            where: {
                id: dto.patrol_route_id,
                tenantId,
                siteId: assignment.shift.siteId,
                status: 'active',
            },
        });
        if (!route) {
            throw new common_1.NotFoundException('Patrol route not found or not active for this site');
        }
        return this.prisma.patrolRun.create({
            data: {
                tenantId,
                shiftId,
                guardId,
                patrolRouteId: dto.patrol_route_id,
                status: 'in_progress',
                startedAt: new Date(),
            },
            include: {
                patrolRoute: {
                    include: {
                        checkpoints: {
                            orderBy: { sequenceOrder: 'asc' },
                            include: { checkpoint: true },
                        },
                    },
                },
            },
        });
    }
    async scanCheckpoint(tenantId, guardId, runId, checkpointId, dto) {
        const run = await this.prisma.patrolRun.findFirst({
            where: {
                id: runId,
                tenantId,
                guardId,
                status: 'in_progress',
            },
            include: {
                patrolRoute: {
                    include: {
                        checkpoints: { include: { checkpoint: true } },
                    },
                },
            },
        });
        if (!run) {
            throw new common_1.NotFoundException('Active patrol run not found');
        }
        const checkpointOnRoute = run.patrolRoute.checkpoints.find((cp) => cp.checkpointId === checkpointId);
        if (!checkpointOnRoute) {
            throw new common_1.BadRequestException('Checkpoint does not belong to this patrol route');
        }
        const verification = this.verifyCheckpointLocation(checkpointOnRoute.checkpoint, dto);
        const eventData = {
            scannedAt: new Date(),
            status: dto?.status || 'completed',
            notes: dto?.notes || null,
            verificationStatus: verification.status,
            distanceMeters: verification.distanceMeters,
            submittedLatitude: verification.submittedLatitude,
            submittedLongitude: verification.submittedLongitude,
        };
        const existingEvent = await this.prisma.patrolEvent.findFirst({
            where: {
                patrolRunId: runId,
                checkpointId,
            },
        });
        if (existingEvent) {
            return this.prisma.patrolEvent.update({
                where: { id: existingEvent.id },
                data: eventData,
                include: {
                    checkpoint: true,
                },
            });
        }
        return this.prisma.patrolEvent.create({
            data: {
                tenantId,
                patrolRunId: runId,
                checkpointId,
                guardId,
                ...eventData,
            },
            include: {
                checkpoint: true,
            },
        });
    }
    verifyCheckpointLocation(checkpoint, dto) {
        const hasGeofence = checkpoint.latitude !== null &&
            checkpoint.longitude !== null &&
            checkpoint.geofenceRadiusMeters !== null;
        if (!hasGeofence) {
            return {
                status: checkpoint_verification_constants_1.CheckpointVerificationStatus.NO_GEOFENCE_CONFIGURED,
                distanceMeters: null,
                submittedLatitude: dto?.latitude ?? null,
                submittedLongitude: dto?.longitude ?? null,
            };
        }
        const hasSubmittedLocation = dto?.latitude !== undefined && dto?.longitude !== undefined;
        if (!hasSubmittedLocation) {
            return {
                status: checkpoint_verification_constants_1.CheckpointVerificationStatus.LOCATION_UNAVAILABLE,
                distanceMeters: null,
                submittedLatitude: null,
                submittedLongitude: null,
            };
        }
        if (!(0, geo_util_1.isValidCoordinate)(dto.latitude, dto.longitude)) {
            return {
                status: checkpoint_verification_constants_1.CheckpointVerificationStatus.INVALID_LOCATION,
                distanceMeters: null,
                submittedLatitude: dto.latitude ?? null,
                submittedLongitude: dto.longitude ?? null,
            };
        }
        const distanceMeters = (0, geo_util_1.haversineDistanceMeters)({
            latitude: checkpoint.latitude,
            longitude: checkpoint.longitude,
        }, { latitude: dto.latitude, longitude: dto.longitude });
        const withinRadius = distanceMeters <= checkpoint.geofenceRadiusMeters;
        return {
            status: withinRadius
                ? checkpoint_verification_constants_1.CheckpointVerificationStatus.SUCCESS
                : checkpoint_verification_constants_1.CheckpointVerificationStatus.OUTSIDE_GEOFENCE,
            distanceMeters: Math.round(distanceMeters),
            submittedLatitude: dto.latitude,
            submittedLongitude: dto.longitude,
        };
    }
    async completePatrolRun(tenantId, guardId, runId) {
        const run = await this.prisma.patrolRun.findFirst({
            where: {
                id: runId,
                tenantId,
                guardId,
                status: 'in_progress',
            },
            include: {
                patrolRoute: {
                    include: {
                        checkpoints: true,
                    },
                },
                events: true,
            },
        });
        if (!run) {
            throw new common_1.NotFoundException('Active patrol run not found');
        }
        const scannedCheckpointIds = new Set(run.events.map((e) => e.checkpointId));
        const missingCheckpoints = run.patrolRoute.checkpoints.filter((cp) => !scannedCheckpointIds.has(cp.checkpointId));
        if (missingCheckpoints.length > 0) {
            await this.prisma.patrolEvent.createMany({
                data: missingCheckpoints.map((cp) => ({
                    tenantId,
                    patrolRunId: runId,
                    checkpointId: cp.checkpointId,
                    guardId,
                    scannedAt: new Date(),
                    status: 'missed',
                    notes: 'Auto-marked missed upon patrol run completion',
                })),
            });
        }
        return this.prisma.patrolRun.update({
            where: { id: runId },
            data: {
                status: 'completed',
                completedAt: new Date(),
            },
            include: {
                events: {
                    include: { checkpoint: true },
                },
            },
        });
    }
    async updateLocation(tenantId, guardId, runId, dto) {
        const run = await this.prisma.patrolRun.findFirst({
            where: {
                id: runId,
                tenantId,
                guardId,
                status: 'in_progress',
            },
            select: { id: true },
        });
        if (!run) {
            throw new common_1.NotFoundException('Active patrol run not found');
        }
        if (!(0, geo_util_1.isValidCoordinate)(dto.latitude, dto.longitude)) {
            throw new common_1.BadRequestException('Invalid coordinates');
        }
        return this.prisma.patrolRun.update({
            where: { id: runId },
            data: {
                lastLatitude: dto.latitude,
                lastLongitude: dto.longitude,
                lastAccuracyMeters: dto.accuracy ?? null,
                lastLocationAt: dto.timestamp ? new Date(dto.timestamp) : new Date(),
            },
            select: {
                id: true,
                lastLatitude: true,
                lastLongitude: true,
                lastAccuracyMeters: true,
                lastLocationAt: true,
            },
        });
    }
    async getGuardPatrolRuns(tenantId, guardId) {
        return this.prisma.patrolRun.findMany({
            where: {
                tenantId,
                guardId,
            },
            include: {
                patrolRoute: {
                    select: { id: true, name: true },
                },
                shift: {
                    select: {
                        id: true,
                        startTime: true,
                        endTime: true,
                        site: { select: { id: true, name: true } },
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    }
    async getLiveSiteStatusForClient(tenantId, clientId) {
        const sites = await this.prisma.site.findMany({
            where: { tenantId, clientId },
            select: { id: true, name: true, address: true },
            orderBy: { name: 'asc' },
        });
        if (sites.length === 0)
            return [];
        const siteIds = sites.map((site) => site.id);
        const activeShifts = await this.prisma.shift.findMany({
            where: { tenantId, siteId: { in: siteIds }, status: 'in_progress' },
            select: {
                id: true,
                siteId: true,
                assignments: {
                    select: {
                        guardId: true,
                        guard: { select: { id: true, name: true } },
                    },
                },
                attendanceEvents: { select: { guardId: true, type: true } },
            },
        });
        const shiftIds = activeShifts.map((shift) => shift.id);
        const assignedGuardIds = Array.from(new Set(activeShifts.flatMap((shift) => shift.assignments.map((a) => a.guardId))));
        const activePatrolRuns = assignedGuardIds.length === 0
            ? []
            : await this.prisma.patrolRun.findMany({
                where: {
                    tenantId,
                    shiftId: { in: shiftIds },
                    guardId: { in: assignedGuardIds },
                    status: 'in_progress',
                },
                select: {
                    shiftId: true,
                    guardId: true,
                    lastLatitude: true,
                    lastLongitude: true,
                    lastAccuracyMeters: true,
                    lastLocationAt: true,
                    patrolRoute: { select: { id: true, name: true } },
                },
            });
        const patrolByShiftGuard = new Map(activePatrolRuns.map((run) => [`${run.shiftId}:${run.guardId}`, run]));
        return sites.map((site) => {
            const guardsOnSite = activeShifts
                .filter((shift) => shift.siteId === site.id)
                .flatMap((shift) => {
                const checkedIn = new Set(shift.attendanceEvents
                    .filter((event) => event.type === 'CHECK_IN')
                    .map((event) => event.guardId));
                const checkedOut = new Set(shift.attendanceEvents
                    .filter((event) => event.type === 'CHECK_OUT')
                    .map((event) => event.guardId));
                return shift.assignments
                    .filter((a) => checkedIn.has(a.guardId) && !checkedOut.has(a.guardId))
                    .map((a) => {
                    const run = patrolByShiftGuard.get(`${shift.id}:${a.guardId}`);
                    return {
                        guardId: a.guardId,
                        guardName: a.guard.name,
                        shiftId: shift.id,
                        patrolRoute: run?.patrolRoute ?? null,
                        location: run && run.lastLatitude !== null && run.lastLongitude !== null
                            ? {
                                latitude: run.lastLatitude,
                                longitude: run.lastLongitude,
                                accuracyMeters: run.lastAccuracyMeters,
                                capturedAt: run.lastLocationAt,
                            }
                            : null,
                    };
                });
            });
            return {
                site: { id: site.id, name: site.name, address: site.address },
                guardsOnSite,
            };
        });
    }
};
exports.PatrolsService = PatrolsService;
exports.PatrolsService = PatrolsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], PatrolsService);
//# sourceMappingURL=patrols.service.js.map