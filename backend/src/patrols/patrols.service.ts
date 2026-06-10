import { BadRequestException, Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { branchWhere } from '../branches/branch-scope';
import { CreateCheckpointDto } from './dto/create-checkpoint.dto';
import { UpdateCheckpointDto } from './dto/update-checkpoint.dto';
import { CreatePatrolRouteDto } from './dto/create-patrol-route.dto';
import { UpdatePatrolRouteDto } from './dto/update-patrol-route.dto';
import { AttachCheckpointsDto } from './dto/attach-checkpoints.dto';
import { StartPatrolRunDto } from './dto/start-patrol-run.dto';
import { ScanCheckpointDto } from './dto/scan-checkpoint.dto';

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

    const checkpoint = await this.prisma.checkpoint.create({
      data: {
        tenantId: user.tenantId,
        siteId: dto.site_id,
        name: dto.name,
        description: dto.description,
        locationNote: dto.location_note,
        qrCodeValue: dto.qr_code_value,
        status: 'active',
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

  async updateCheckpoint(user: ActiveUser, id: string, dto: UpdateCheckpointDto) {
    const checkpoint = await this.prisma.checkpoint.findFirst({
      where: { id, tenantId: user.tenantId, site: { ...branchWhere(user) } },
    });
    if (!checkpoint) {
      throw new NotFoundException('Checkpoint not found');
    }

    const updated = await this.prisma.checkpoint.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.location_note !== undefined ? { locationNote: dto.location_note } : {}),
        ...(dto.qr_code_value !== undefined ? { qrCodeValue: dto.qr_code_value } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
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

  async updatePatrolRoute(user: ActiveUser, id: string, dto: UpdatePatrolRouteDto) {
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
        ...(dto.description !== undefined ? { description: dto.description } : {}),
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

  async attachCheckpoints(user: ActiveUser, routeId: string, dto: AttachCheckpointsDto) {
    const route = await this.prisma.patrolRoute.findFirst({
      where: { id: routeId, tenantId: user.tenantId, site: { ...branchWhere(user) } },
    });
    if (!route) {
      throw new NotFoundException('Patrol route not found');
    }

    const checkpointIds = dto.checkpoints.map(cp => cp.checkpoint_id);
    const validCheckpoints = await this.prisma.checkpoint.findMany({
      where: {
        id: { in: checkpointIds },
        tenantId: user.tenantId,
        siteId: route.siteId,
      },
    });

    if (validCheckpoints.length !== checkpointIds.length) {
      throw new BadRequestException('Some checkpoints do not exist or do not belong to this site');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.patrolRouteCheckpoint.deleteMany({
        where: { patrolRouteId: routeId },
      });

      if (dto.checkpoints.length > 0) {
        await tx.patrolRouteCheckpoint.createMany({
          data: dto.checkpoints.map(cp => ({
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

  async findAllPatrolRuns(user: ActiveUser) {
    return this.prisma.patrolRun.findMany({
      where: {
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
          },
        },
      },
    });
    if (!run) {
      throw new NotFoundException('Patrol run not found');
    }
    return run;
  }

  // ==========================================
  // GUARD PORTAL SERVICE METHODS
  // ==========================================

  async getShiftPatrolRoutes(tenantId: string, guardId: string, shiftId: string) {
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

  async startPatrolRun(tenantId: string, guardId: string, shiftId: string, dto: StartPatrolRunDto) {
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
      throw new NotFoundException('Patrol route not found or not active for this site');
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

  async scanCheckpoint(tenantId: string, guardId: string, runId: string, checkpointId: string, dto?: ScanCheckpointDto) {
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
      },
    });
    if (!run) {
      throw new NotFoundException('Active patrol run not found');
    }

    const checkpointOnRoute = run.patrolRoute.checkpoints.find(
      (cp) => cp.checkpointId === checkpointId,
    );
    if (!checkpointOnRoute) {
      throw new BadRequestException('Checkpoint does not belong to this patrol route');
    }

    const existingEvent = await this.prisma.patrolEvent.findFirst({
      where: {
        patrolRunId: runId,
        checkpointId,
      },
    });

    if (existingEvent) {
      return this.prisma.patrolEvent.update({
        where: { id: existingEvent.id },
        data: {
          scannedAt: new Date(),
          status: dto?.status || 'completed',
          notes: dto?.notes || null,
        },
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
        scannedAt: new Date(),
        status: dto?.status || 'completed',
        notes: dto?.notes || null,
      },
      include: {
        checkpoint: true,
      },
    });
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
}
