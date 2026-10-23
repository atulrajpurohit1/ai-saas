import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { EmailService } from '../email/email.service';
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
  private readonly logger = new Logger(EmergencyAlertsService.name);

  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private emailService: EmailService,
  ) {}

  /**
   * Verified admin addresses for a tenant -- who a safety alert is emailed to.
   * ADMIN is the legacy owner/admin role (the founding user defaults to it),
   * which is the right audience for "the admin should be notified". Unverified
   * addresses are skipped: an unverified user cannot log in to act on the
   * alert anyway.
   */
  private async adminRecipients(tenantId: string): Promise<string[]> {
    const users = await this.prisma.user.findMany({
      where: { tenantId, role: UserRole.ADMIN, emailVerified: true },
      select: { email: true },
    });
    return users
      .map((u) => u.email?.trim())
      .filter((email): email is string => !!email);
  }

  /**
   * Emails the tenant's admins about an alert. Best-effort: a mail failure is
   * logged but never thrown, because the alert itself is already recorded and
   * a dropped email must not look to the guard like the alert failed to send.
   */
  private async notifyAdmins(
    alert: AlertWithRelations,
    resent: boolean,
  ): Promise<void> {
    try {
      const recipients = await this.adminRecipients(alert.tenantId);
      if (recipients.length === 0) {
        this.logger.warn(
          `Emergency alert ${alert.id} for tenant ${alert.tenantId} has no verified admin recipient to email.`,
        );
        return;
      }
      await this.emailService.sendEmergencyAlertEmail(alert.tenantId, {
        recipients,
        guardName: alert.guard?.name ?? 'A guard',
        triggeredAt: alert.triggeredAt,
        siteName: alert.patrolRun?.shift?.site?.name ?? null,
        branchName: alert.branch?.name ?? null,
        location:
          alert.lastLatitude !== null && alert.lastLongitude !== null
            ? { latitude: alert.lastLatitude, longitude: alert.lastLongitude }
            : null,
        resent,
      });
    } catch (error) {
      this.logger.error(
        `Failed to email admins about emergency alert ${alert.id}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

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
  // body. One live alert per guard: a guard with an existing ACTIVE alert does
  // not create a duplicate (this is what prevents a rapid double-tap, or a
  // retried request after a flaky response, from creating two live alerts for
  // one emergency). Pressing the button again instead RE-NOTIFIES dispatch --
  // a panic button that does nothing on the second press would be dangerous,
  // and this is how a guard escalates when no one has responded yet.
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
      await this.auditService.log({
        tenantId,
        userId: guardId,
        action: 'EMERGENCY_ALERT_RESENT',
        entityType: 'EmergencyAlert',
        entityId: existingActive.id,
        details: `Guard "${guard.name}" re-sent an active panic/duress alert`,
      });
      await this.notifyAdmins(existingActive, true);
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

    await this.notifyAdmins(created, false);

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
