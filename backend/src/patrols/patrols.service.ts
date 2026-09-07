import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Checkpoint } from '@prisma/client';
import { createReadStream, existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { branchWhere } from '../branches/branch-scope';
import { haversineDistanceMeters, isValidCoordinate } from '../common/geo.util';
import {
  PATROL_EVIDENCE_UPLOAD_DIR,
  isAllowedPatrolEvidencePhoto,
  patrolEvidenceImageMaxBytes,
  patrolEvidenceImageMaxMb,
} from '../common/file-storage.util';
import { CreateCheckpointDto } from './dto/create-checkpoint.dto';
import { UpdateCheckpointDto } from './dto/update-checkpoint.dto';
import { CreatePatrolRouteDto } from './dto/create-patrol-route.dto';
import { UpdatePatrolRouteDto } from './dto/update-patrol-route.dto';
import { AttachCheckpointsDto } from './dto/attach-checkpoints.dto';
import { StartPatrolRunDto } from './dto/start-patrol-run.dto';
import { ScanCheckpointDto } from './dto/scan-checkpoint.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import {
  CheckpointVerificationStatus,
  DEFAULT_GEOFENCE_RADIUS_METERS,
} from './checkpoint-verification.constants';

@Injectable()
export class PatrolsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  // ==========================================
  // ADMIN SERVICE METHODS
  // ==========================================

  async createCheckpoint(user: ActiveUser, dto: CreateCheckpointDto) {
    const site = await this.prisma.site.findFirst({
      where: { id: dto.site_id, tenantId: user.tenantId, ...branchWhere(user) },
    });
    if (!site) {
      throw new NotFoundException('Site not found');
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

  async findAllCheckpoints(user: ActiveUser, siteId?: string) {
    const siteFilter = siteId
      ? { id: siteId, tenantId: user.tenantId, ...branchWhere(user) }
      : { tenantId: user.tenantId, ...branchWhere(user) };

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

  async updateCheckpoint(
    user: ActiveUser,
    id: string,
    dto: UpdateCheckpointDto,
  ) {
    const checkpoint = await this.prisma.checkpoint.findFirst({
      where: { id, tenantId: user.tenantId, site: { ...branchWhere(user) } },
    });
    if (!checkpoint) {
      throw new NotFoundException('Checkpoint not found');
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

  // Requires both latitude and longitude together (a checkpoint can't have
  // just one), defaults the radius when omitted, and leaves the geofence
  // entirely unset when neither coordinate is provided.
  private resolveGeofenceForCreate(dto: CreateCheckpointDto) {
    const hasLatitude = dto.latitude !== undefined;
    const hasLongitude = dto.longitude !== undefined;

    if (hasLatitude !== hasLongitude) {
      throw new BadRequestException(
        'Both latitude and longitude are required to configure a checkpoint geofence',
      );
    }

    if (!hasLatitude) {
      return { latitude: null, longitude: null, geofenceRadiusMeters: null };
    }

    return {
      latitude: dto.latitude as number,
      longitude: dto.longitude as number,
      geofenceRadiusMeters:
        dto.geofence_radius_meters ?? DEFAULT_GEOFENCE_RADIUS_METERS,
    };
  }

  private resolveGeofenceForUpdate(
    checkpoint: Checkpoint,
    dto: UpdateCheckpointDto,
  ) {
    if (dto.clear_geofence) {
      return { latitude: null, longitude: null, geofenceRadiusMeters: null };
    }

    const touchesGeofence =
      dto.latitude !== undefined ||
      dto.longitude !== undefined ||
      dto.geofence_radius_meters !== undefined;
    if (!touchesGeofence) {
      return {};
    }

    const latitude = dto.latitude ?? checkpoint.latitude;
    const longitude = dto.longitude ?? checkpoint.longitude;

    if ((latitude === null) !== (longitude === null)) {
      throw new BadRequestException(
        'Both latitude and longitude are required to configure a checkpoint geofence',
      );
    }

    if (latitude === null || longitude === null) {
      return { latitude: null, longitude: null, geofenceRadiusMeters: null };
    }

    return {
      latitude,
      longitude,
      geofenceRadiusMeters:
        dto.geofence_radius_meters ??
        checkpoint.geofenceRadiusMeters ??
        DEFAULT_GEOFENCE_RADIUS_METERS,
    };
  }

  async createPatrolRoute(user: ActiveUser, dto: CreatePatrolRouteDto) {
    const site = await this.prisma.site.findFirst({
      where: { id: dto.site_id, tenantId: user.tenantId, ...branchWhere(user) },
    });
    if (!site) {
      throw new NotFoundException('Site not found');
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

  async findAllPatrolRoutes(user: ActiveUser, siteId?: string) {
    const siteFilter = siteId
      ? { id: siteId, tenantId: user.tenantId, ...branchWhere(user) }
      : { tenantId: user.tenantId, ...branchWhere(user) };

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

  async findPatrolRoute(user: ActiveUser, id: string) {
    const route = await this.prisma.patrolRoute.findFirst({
      where: { id, tenantId: user.tenantId, site: { ...branchWhere(user) } },
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
      throw new NotFoundException('Patrol route not found');
    }
    return route;
  }

  async updatePatrolRoute(
    user: ActiveUser,
    id: string,
    dto: UpdatePatrolRouteDto,
  ) {
    const route = await this.prisma.patrolRoute.findFirst({
      where: { id, tenantId: user.tenantId, site: { ...branchWhere(user) } },
    });
    if (!route) {
      throw new NotFoundException('Patrol route not found');
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

  async attachCheckpoints(
    user: ActiveUser,
    routeId: string,
    dto: AttachCheckpointsDto,
  ) {
    const route = await this.prisma.patrolRoute.findFirst({
      where: {
        id: routeId,
        tenantId: user.tenantId,
        site: { ...branchWhere(user) },
      },
    });
    if (!route) {
      throw new NotFoundException('Patrol route not found');
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
      throw new BadRequestException(
        'Some checkpoints do not exist or do not belong to this site',
      );
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

  async findAllPatrolRuns(user: ActiveUser, status?: string) {
    return this.prisma.patrolRun.findMany({
      where: {
        tenantId: user.tenantId,
        shift: { ...branchWhere(user) },
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

  async findPatrolRun(user: ActiveUser, id: string) {
    const run = await this.prisma.patrolRun.findFirst({
      where: {
        id,
        tenantId: user.tenantId,
        shift: { ...branchWhere(user) },
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
            // Phase 3H: id-only so the admin UI can show a photo count /
            // "view evidence" affordance per scan without a second round
            // trip. The bytes themselves are still streamed on demand
            // through the authenticated evidence-file endpoint.
            evidence: {
              orderBy: { createdAt: 'desc' },
              select: {
                id: true,
                mediaType: true,
                mimeType: true,
                fileName: true,
                fileSizeBytes: true,
                createdAt: true,
              },
            },
          },
        },
      },
    });
    if (!run) {
      throw new NotFoundException('Patrol run not found');
    }
    return run;
  }

  // Admin-side aggregate patrol-monitoring view: one call that answers
  // "what is happening across every guard and site right now". Read-only,
  // branch-scoped, and built entirely from existing PatrolRun / PatrolEvent
  // data - no new tracking is introduced. `last*` location fields are surfaced
  // as-is (Phase 3B), only for runs that are currently in progress.
  async getPatrolOverview(user: ActiveUser) {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const runs = await this.prisma.patrolRun.findMany({
      where: {
        tenantId: user.tenantId,
        shift: { ...branchWhere(user) },
        OR: [
          { status: 'in_progress' },
          { status: 'active' },
          { completedAt: { gte: startOfToday } },
          { startedAt: { gte: startOfToday } },
        ],
      },
      include: {
        guard: { select: { id: true, name: true } },
        patrolRoute: {
          select: {
            id: true,
            name: true,
            _count: { select: { checkpoints: true } },
          },
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
          select: { id: true, status: true, verificationStatus: true, scannedAt: true },
        },
      },
      orderBy: { startedAt: 'desc' },
    });

    const isActive = (status: string) =>
      status === 'in_progress' || status === 'active';

    const rows = runs.map((run) => {
      const totalCheckpoints = run.patrolRoute?._count.checkpoints ?? 0;
      const scanned = run.events.filter((e) => e.status === 'completed').length;
      const missed = run.events.filter((e) => e.status === 'missed').length;
      const geofenceFailures = run.events.filter(
        (e) => e.verificationStatus === 'OUTSIDE_GEOFENCE',
      ).length;
      const lastScanAt = run.events.reduce<Date | null>((latest, e) => {
        if (!e.scannedAt) return latest;
        return !latest || e.scannedAt > latest ? e.scannedAt : latest;
      }, null);

      return {
        id: run.id,
        status: run.status,
        active: isActive(run.status),
        startedAt: run.startedAt,
        completedAt: run.completedAt,
        guard: run.guard,
        route: run.patrolRoute
          ? { id: run.patrolRoute.id, name: run.patrolRoute.name }
          : null,
        site: run.shift?.site ?? null,
        shift: run.shift
          ? { id: run.shift.id, startTime: run.shift.startTime, endTime: run.shift.endTime }
          : null,
        checkpoints: { scanned, total: totalCheckpoints, missed },
        geofenceFailures,
        lastScanAt,
        location: isActive(run.status)
          ? {
              latitude: run.lastLatitude,
              longitude: run.lastLongitude,
              accuracyMeters: run.lastAccuracyMeters,
              at: run.lastLocationAt,
            }
          : null,
      };
    });

    const activeRows = rows.filter((r) => r.active);
    const completedTodayRows = rows.filter(
      (r) => !r.active && r.completedAt && r.completedAt >= startOfToday,
    );

    return {
      generatedAt: new Date(),
      summary: {
        activeRuns: activeRows.length,
        guardsOnPatrol: new Set(activeRows.map((r) => r.guard?.id).filter(Boolean))
          .size,
        completedToday: completedTodayRows.length,
        checkpointsScannedToday: rows.reduce(
          (sum, r) =>
            sum +
            (r.completedAt && r.completedAt >= startOfToday ? r.checkpoints.scanned : 0),
          0,
        ),
        missedCheckpointsToday: rows.reduce(
          (sum, r) => sum + r.checkpoints.missed,
          0,
        ),
        geofenceFailuresToday: rows.reduce(
          (sum, r) => sum + r.geofenceFailures,
          0,
        ),
      },
      activeRuns: activeRows,
      completedToday: completedTodayRows,
    };
  }

  // ==========================================
  // GUARD PORTAL SERVICE METHODS
  // ==========================================

  async getShiftPatrolRoutes(
    tenantId: string,
    guardId: string,
    shiftId: string,
  ) {
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
      throw new ForbiddenException('You are not assigned to this shift');
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

  async startPatrolRun(
    tenantId: string,
    guardId: string,
    shiftId: string,
    dto: StartPatrolRunDto,
  ) {
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
      throw new ForbiddenException('You are not assigned to this shift');
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
      throw new NotFoundException(
        'Patrol route not found or not active for this site',
      );
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

  async scanCheckpoint(
    tenantId: string,
    guardId: string,
    runId: string,
    checkpointId: string,
    dto?: ScanCheckpointDto,
  ) {
    // Authorization: the run must genuinely belong to this guard (from the
    // JWT, never client-supplied) and be in progress - this is the existing
    // check that already prevents a guard from scanning another guard's
    // run. The checkpoint-on-route check below similarly prevents scanning
    // a checkpoint ID that isn't actually part of this run's route.
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
      throw new NotFoundException('Active patrol run not found');
    }

    const checkpointOnRoute = run.patrolRoute.checkpoints.find(
      (cp) => cp.checkpointId === checkpointId,
    );
    if (!checkpointOnRoute) {
      throw new BadRequestException(
        'Checkpoint does not belong to this patrol route',
      );
    }

    const verification = this.verifyCheckpointLocation(
      checkpointOnRoute.checkpoint,
      dto,
    );

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

  // The server is the sole source of truth for geofence verification - it
  // never accepts a verdict from the client, only raw coordinates (or none).
  private verifyCheckpointLocation(
    checkpoint: Checkpoint,
    dto?: ScanCheckpointDto,
  ) {
    const hasGeofence =
      checkpoint.latitude !== null &&
      checkpoint.longitude !== null &&
      checkpoint.geofenceRadiusMeters !== null;

    if (!hasGeofence) {
      return {
        status: CheckpointVerificationStatus.NO_GEOFENCE_CONFIGURED,
        distanceMeters: null,
        submittedLatitude: dto?.latitude ?? null,
        submittedLongitude: dto?.longitude ?? null,
      };
    }

    const hasSubmittedLocation =
      dto?.latitude !== undefined && dto?.longitude !== undefined;
    if (!hasSubmittedLocation) {
      return {
        status: CheckpointVerificationStatus.LOCATION_UNAVAILABLE,
        distanceMeters: null,
        submittedLatitude: null,
        submittedLongitude: null,
      };
    }

    if (!isValidCoordinate(dto.latitude, dto.longitude)) {
      return {
        status: CheckpointVerificationStatus.INVALID_LOCATION,
        distanceMeters: null,
        submittedLatitude: dto.latitude ?? null,
        submittedLongitude: dto.longitude ?? null,
      };
    }

    const distanceMeters = haversineDistanceMeters(
      {
        latitude: checkpoint.latitude as number,
        longitude: checkpoint.longitude as number,
      },
      { latitude: dto.latitude as number, longitude: dto.longitude as number },
    );
    const withinRadius =
      distanceMeters <= (checkpoint.geofenceRadiusMeters as number);

    return {
      status: withinRadius
        ? CheckpointVerificationStatus.SUCCESS
        : CheckpointVerificationStatus.OUTSIDE_GEOFENCE,
      distanceMeters: Math.round(distanceMeters),
      submittedLatitude: dto.latitude as number,
      submittedLongitude: dto.longitude as number,
    };
  }

  async completePatrolRun(tenantId: string, guardId: string, runId: string) {
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
      throw new NotFoundException('Active patrol run not found');
    }

    const scannedCheckpointIds = new Set(run.events.map((e) => e.checkpointId));
    const missingCheckpoints = run.patrolRoute.checkpoints.filter(
      (cp) => !scannedCheckpointIds.has(cp.checkpointId),
    );

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

  // Phase 3B: live location tracking, scoped to an active patrol run only.
  // Authorization mirrors scanCheckpoint exactly - the run must belong to
  // this guard (from the JWT, never client-supplied), this tenant, and be
  // in_progress. Once the run isn't in_progress (completed, or any future
  // cancelled/missed state), updates are rejected - tracking stops the
  // instant the patrol does, with no separate "stop tracking" call needed.
  async updateLocation(
    tenantId: string,
    guardId: string,
    runId: string,
    dto: UpdateLocationDto,
  ) {
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
      throw new NotFoundException('Active patrol run not found');
    }

    if (!isValidCoordinate(dto.latitude, dto.longitude)) {
      throw new BadRequestException('Invalid coordinates');
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

  async getGuardPatrolRuns(tenantId: string, guardId: string) {
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

  // ==========================================
  // PATROL EVIDENCE (Phase 3H) - photo attachments on a checkpoint scan
  // ==========================================
  //
  // Modelled on IncidentsService's Phase 3F evidence methods. Every
  // tenant / patrol / checkpoint decision is made server-side from data
  // that is already trusted (the JWT-derived guardId/tenantId, or the
  // branch-scoped admin read) - the request body / file never carries
  // authority.

  private serializePatrolEvidence(evidence: {
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
  }) {
    // storedFileName is deliberately never included - it is an internal
    // on-disk path fragment and exposing it would enable enumeration.
    return {
      id: evidence.id,
      patrolEventId: evidence.patrolEventId,
      patrolRunId: evidence.patrolRunId,
      guardId: evidence.guardId,
      mediaType: evidence.mediaType,
      mimeType: evidence.mimeType,
      fileName: evidence.fileName,
      fileSizeBytes: evidence.fileSizeBytes,
      uploadedById: evidence.uploadedById,
      createdAt: evidence.createdAt,
    };
  }

  private unlinkPatrolEvidenceQuietly(storedFileName: string) {
    try {
      const filePath = join(PATROL_EVIDENCE_UPLOAD_DIR, storedFileName);
      if (existsSync(filePath)) {
        unlinkSync(filePath);
      }
    } catch {
      // Best-effort cleanup - a missing file must not block the DB operation.
    }
  }

  // Resolves the patrol event a guard is allowed to attach evidence to: it
  // must belong to this guard (from the JWT, never client-supplied), this
  // tenant, and sit on a patrol run that is still in_progress. A
  // cross-tenant / cross-guard / cross-run event id simply does not match -
  // this is the same authorization shape as scanCheckpoint.
  private async findGuardPatrolEventForEvidence(
    tenantId: string,
    guardId: string,
    runId: string,
    eventId: string,
  ) {
    const event = await this.prisma.patrolEvent.findFirst({
      where: {
        id: eventId,
        tenantId,
        guardId,
        patrolRunId: runId,
        patrolRun: { tenantId, guardId, status: 'in_progress' },
      },
      include: { checkpoint: { select: { name: true } } },
    });
    if (!event) {
      throw new NotFoundException('Checkpoint scan not found for this patrol');
    }
    return event;
  }

  // Resolves a patrol event an admin caller may see, using the exact same
  // tenant + branch scoping as every other admin patrol-run read.
  private async findAdminPatrolEventForEvidence(
    user: ActiveUser,
    runId: string,
    eventId: string,
  ) {
    const event = await this.prisma.patrolEvent.findFirst({
      where: {
        id: eventId,
        tenantId: user.tenantId,
        patrolRunId: runId,
        patrolRun: {
          tenantId: user.tenantId,
          shift: { ...branchWhere(user) },
        },
      },
      include: { checkpoint: { select: { name: true } } },
    });
    if (!event) {
      throw new NotFoundException('Checkpoint scan not found');
    }
    return event;
  }

  async addCheckpointEvidenceForGuard(
    tenantId: string,
    guardId: string,
    runId: string,
    eventId: string,
    file: Express.Multer.File,
  ) {
    const event = await this.findGuardPatrolEventForEvidence(
      tenantId,
      guardId,
      runId,
      eventId,
    );

    if (!isAllowedPatrolEvidencePhoto(file.originalname, file.mimetype)) {
      this.unlinkPatrolEvidenceQuietly(file.filename);
      throw new BadRequestException(
        'Unsupported file. Only photo evidence (JPG, PNG, WEBP, GIF, HEIC) is allowed.',
      );
    }

    if (file.size > patrolEvidenceImageMaxBytes()) {
      this.unlinkPatrolEvidenceQuietly(file.filename);
      throw new BadRequestException(
        `Photo evidence must be ${patrolEvidenceImageMaxMb()} MB or smaller.`,
      );
    }

    const created = await this.prisma.patrolEvidence.create({
      data: {
        tenantId,
        patrolEventId: event.id,
        patrolRunId: event.patrolRunId,
        guardId,
        mediaType: 'image',
        mimeType: file.mimetype.toLowerCase().split(';')[0].trim(),
        fileName: file.originalname,
        storedFileName: file.filename,
        fileSizeBytes: file.size,
        uploadedById: guardId,
      },
    });

    await this.auditService.log({
      tenantId,
      userId: guardId,
      action: 'PATROL_EVIDENCE_UPLOADED',
      entityType: 'PatrolEvidence',
      entityId: created.id,
      details: `Guard attached photo evidence to checkpoint "${event.checkpoint?.name ?? 'checkpoint'}" scan`,
    });

    return this.serializePatrolEvidence(created);
  }

  async listCheckpointEvidenceForGuard(
    tenantId: string,
    guardId: string,
    runId: string,
    eventId: string,
  ) {
    // A guard may only read evidence on their own patrol event. The run does
    // not need to still be in_progress to review what was already attached,
    // so this uses a looser check than the upload path.
    const event = await this.prisma.patrolEvent.findFirst({
      where: { id: eventId, tenantId, guardId, patrolRunId: runId },
      select: { id: true },
    });
    if (!event) {
      throw new NotFoundException('Checkpoint scan not found for this patrol');
    }
    const items = await this.prisma.patrolEvidence.findMany({
      where: { tenantId, patrolEventId: eventId },
      orderBy: { createdAt: 'desc' },
    });
    return items.map((item) => this.serializePatrolEvidence(item));
  }

  async listCheckpointEvidenceForAdmin(
    user: ActiveUser,
    runId: string,
    eventId: string,
  ) {
    await this.findAdminPatrolEventForEvidence(user, runId, eventId);
    const items = await this.prisma.patrolEvidence.findMany({
      where: { tenantId: user.tenantId, patrolEventId: eventId },
      orderBy: { createdAt: 'desc' },
    });
    return items.map((item) => this.serializePatrolEvidence(item));
  }

  async getCheckpointEvidenceFileForAdmin(
    user: ActiveUser,
    runId: string,
    eventId: string,
    evidenceId: string,
  ) {
    await this.findAdminPatrolEventForEvidence(user, runId, eventId);
    return this.resolvePatrolEvidenceFile(user.tenantId, eventId, evidenceId);
  }

  async getCheckpointEvidenceFileForGuard(
    tenantId: string,
    guardId: string,
    runId: string,
    eventId: string,
    evidenceId: string,
  ) {
    const event = await this.prisma.patrolEvent.findFirst({
      where: { id: eventId, tenantId, guardId, patrolRunId: runId },
      select: { id: true },
    });
    if (!event) {
      throw new NotFoundException('Checkpoint scan not found for this patrol');
    }
    return this.resolvePatrolEvidenceFile(tenantId, eventId, evidenceId);
  }

  private async resolvePatrolEvidenceFile(
    tenantId: string,
    patrolEventId: string,
    evidenceId: string,
  ) {
    const evidence = await this.prisma.patrolEvidence.findFirst({
      where: { id: evidenceId, tenantId, patrolEventId },
    });
    if (!evidence) {
      throw new NotFoundException('Evidence not found');
    }

    const filePath = join(PATROL_EVIDENCE_UPLOAD_DIR, evidence.storedFileName);
    if (!existsSync(filePath)) {
      throw new NotFoundException('Evidence file not found on server');
    }

    return {
      stream: createReadStream(filePath),
      mimeType: evidence.mimeType,
      fileName: evidence.fileName,
      fileSizeBytes: evidence.fileSizeBytes,
      mediaType: evidence.mediaType,
    };
  }

  // ==========================================
  // CLIENT PORTAL SERVICE METHODS
  // ==========================================

  // Phase 3E: "guard on site now" for the client portal. Reuses Phase 3B's
  // PatrolRun.last* location fields exactly as-is - no new location
  // tracking is introduced here. Presence itself is derived from
  // AttendanceEvent (the guard's own check-in/check-out record), not the
  // shift-wide `status` flag, since that flag is set by whichever assigned
  // guard last acted and is not reliable per-guard on a multi-guard shift.
  async getLiveSiteStatusForClient(tenantId: string, clientId: string) {
    const sites = await this.prisma.site.findMany({
      where: { tenantId, clientId },
      select: { id: true, name: true, address: true },
      orderBy: { name: 'asc' },
    });
    if (sites.length === 0) return [];

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
    const assignedGuardIds = Array.from(
      new Set(
        activeShifts.flatMap((shift) =>
          shift.assignments.map((a) => a.guardId),
        ),
      ),
    );

    const activePatrolRuns =
      assignedGuardIds.length === 0
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
    const patrolByShiftGuard = new Map(
      activePatrolRuns.map((run) => [`${run.shiftId}:${run.guardId}`, run]),
    );

    return sites.map((site) => {
      const guardsOnSite = activeShifts
        .filter((shift) => shift.siteId === site.id)
        .flatMap((shift) => {
          const checkedIn = new Set(
            shift.attendanceEvents
              .filter((event) => event.type === 'CHECK_IN')
              .map((event) => event.guardId),
          );
          const checkedOut = new Set(
            shift.attendanceEvents
              .filter((event) => event.type === 'CHECK_OUT')
              .map((event) => event.guardId),
          );

          return shift.assignments
            .filter(
              (a) => checkedIn.has(a.guardId) && !checkedOut.has(a.guardId),
            )
            .map((a) => {
              const run = patrolByShiftGuard.get(`${shift.id}:${a.guardId}`);
              return {
                guardId: a.guardId,
                guardName: a.guard.name,
                shiftId: shift.id,
                patrolRoute: run?.patrolRoute ?? null,
                location:
                  run && run.lastLatitude !== null && run.lastLongitude !== null
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
}
