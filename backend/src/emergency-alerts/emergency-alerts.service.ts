import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { branchWhere } from '../branches/branch-scope';
import {
  EmergencyAlertStatus,
  assertCanAcknowledge,
  assertCanResolve,
} from './emergency-alert-status.util';
import { EmergencyAlertActionDto } from './dto/emergency-alert-action.dto';

const alertInclude = {
  guard: { select: { id: true, name: true, phone: true } },
  branch: { select: { id: true, name: true } },
  patrolRun: {
    select: {
      id: true,
      status: true,
      patrolRoute: { select: { id: true, name: true } },
      shift: {
        select: {
          id: true,
          site: { select: { id: true, name: true } },
        },
      },
    },
  },
  acknowledgedBy: { select: { id: true, name: true, email: true } },
  resolvedBy: { select: { id: true, name: true, email: true } },
} as const;

type AlertWithRelations = Prisma.EmergencyAlertGetPayload<{
  include: typeof alertInclude;
}>;

@Injectable()
export class EmergencyAlertsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  private serialize(alert: AlertWithRelations) {
    return {
      id: alert.id,
      status: alert.status,
      triggeredAt: alert.triggeredAt,
      acknowledgedAt: alert.acknowledgedAt,
      resolvedAt: alert.resolvedAt,
      notes: alert.notes,
      guard: alert.guard,
      branch: alert.branch,
      site: alert.patrolRun?.shift?.site ?? null,
      patrolRoute: alert.patrolRun?.patrolRoute ?? null,
      patrolRunId: alert.patrolRun?.id ?? null,
      acknowledgedBy: alert.acknowledgedBy,
      resolvedBy: alert.resolvedBy,
      location:
        alert.lastLatitude !== null && alert.lastLongitude !== null
          ? {
              latitude: alert.lastLatitude,
              longitude: alert.lastLongitude,
              accuracyMeters: alert.lastAccuracyMeters,
              capturedAt: alert.locationCapturedAt,
            }
          : null,
      createdAt: alert.createdAt,
      updatedAt: alert.updatedAt,
    };
  }

  // Guard trigger - identity, tenant, and patrol context are ALL derived
  // server-side from the authenticated guard's JWT, never from the request
  // body. Idempotent: a guard with an existing ACTIVE alert gets that same
  // alert back instead of creating a duplicate (this is what prevents a
  // rapid double-tap, or a retried request after a flaky response, from
  // creating two live alerts for one emergency).
  async triggerForGuard(tenantId: string, guardId: string) {
    const guard = await this.prisma.guard.findFirst({
      where: { id: guardId, tenantId },
      select: { id: true, name: true, branchId: true },
    });
    if (!guard) {
      throw new NotFoundException('Guard not found');
    }

    const existingActive = await this.prisma.emergencyAlert.findFirst({
      where: {
        tenantId,
        guardId,
        status: EmergencyAlertStatus.ACTIVE,
      },
      include: alertInclude,
      orderBy: { triggeredAt: 'desc' },
    });
    if (existingActive) {
      return this.serialize(existingActive);
    }

    // Reuse Phase 3B's live location tracking rather than starting a
    // second one - only an in_progress patrol run has a maintained
    // lastLatitude/lastLongitude, and only that snapshot is copied in.
    const activeRun = await this.prisma.patrolRun.findFirst({
      where: { tenantId, guardId, status: 'in_progress' },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        lastLatitude: true,
        lastLongitude: true,
        lastAccuracyMeters: true,
        lastLocationAt: true,
      },
    });

    const created = await this.prisma.emergencyAlert.create({
      data: {
        tenantId,
        guardId,
        branchId: guard.branchId,
        patrolRunId: activeRun?.id ?? null,
        status: EmergencyAlertStatus.ACTIVE,
        lastLatitude: activeRun?.lastLatitude ?? null,
        lastLongitude: activeRun?.lastLongitude ?? null,
        lastAccuracyMeters: activeRun?.lastAccuracyMeters ?? null,
        locationCapturedAt: activeRun?.lastLocationAt ?? null,
      },
      include: alertInclude,
    });

    await this.auditService.log({
      tenantId,
      userId: guardId,
      action: 'EMERGENCY_ALERT_TRIGGERED',
      entityType: 'EmergencyAlert',
      entityId: created.id,
      details: `Guard "${guard.name}" triggered a panic/duress alert${activeRun ? ' during an active patrol' : ''}`,
    });

    return this.serialize(created);
  }

  async findActiveForGuard(tenantId: string, guardId: string) {
    const alert = await this.prisma.emergencyAlert.findFirst({
      where: {
        tenantId,
        guardId,
        status: {
          in: [EmergencyAlertStatus.ACTIVE, EmergencyAlertStatus.ACKNOWLEDGED],
        },
      },
      include: alertInclude,
      orderBy: { triggeredAt: 'desc' },
    });
    return alert ? this.serialize(alert) : null;
  }

  async findAllForAdmin(user: ActiveUser, status?: string) {
    const alerts = await this.prisma.emergencyAlert.findMany({
      where: {
        tenantId: user.tenantId,
        ...branchWhere(user),
        ...(status ? { status } : {}),
      },
      include: alertInclude,
      orderBy: { triggeredAt: 'desc' },
    });
    return alerts.map((alert) => this.serialize(alert));
  }

  private async findAlertOrThrow(user: ActiveUser, id: string) {
    const alert = await this.prisma.emergencyAlert.findFirst({
      where: { id, tenantId: user.tenantId, ...branchWhere(user) },
      include: alertInclude,
    });
    if (!alert) {
      throw new NotFoundException('Emergency alert not found');
    }
    return alert;
  }

  async acknowledge(
    user: ActiveUser,
    id: string,
    dto: EmergencyAlertActionDto,
  ) {
    const alert = await this.findAlertOrThrow(user, id);
    assertCanAcknowledge(alert.status);

    const updated = await this.prisma.emergencyAlert.update({
      where: { id },
      data: {
        status: EmergencyAlertStatus.ACKNOWLEDGED,
        acknowledgedAt: new Date(),
        acknowledgedById: user.sub,
        ...(dto.notes !== undefined ? { notes: dto.notes || null } : {}),
      },
      include: alertInclude,
    });

    await this.auditService.log({
      tenantId: user.tenantId,
      userId: user.sub,
      action: 'EMERGENCY_ALERT_ACKNOWLEDGED',
      entityType: 'EmergencyAlert',
      entityId: id,
      details: `Acknowledged panic/duress alert for guard "${alert.guard?.name}"`,
    });

    return this.serialize(updated);
  }

  async resolve(user: ActiveUser, id: string, dto: EmergencyAlertActionDto) {
    const alert = await this.findAlertOrThrow(user, id);
    assertCanResolve(alert.status);

    const updated = await this.prisma.emergencyAlert.update({
      where: { id },
      data: {
        status: EmergencyAlertStatus.RESOLVED,
        resolvedAt: new Date(),
        resolvedById: user.sub,
        ...(dto.notes !== undefined ? { notes: dto.notes || null } : {}),
      },
      include: alertInclude,
    });

    await this.auditService.log({
      tenantId: user.tenantId,
      userId: user.sub,
      action: 'EMERGENCY_ALERT_RESOLVED',
      entityType: 'EmergencyAlert',
      entityId: id,
      details: `Resolved panic/duress alert for guard "${alert.guard?.name}"`,
    });

    return this.serialize(updated);
  }
}
