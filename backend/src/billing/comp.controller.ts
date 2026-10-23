import {
  Body,
  Controller,
  Get,
  Logger,
  NotFoundException,
  Post,
  UseGuards,
} from '@nestjs/common';
import { GetPlatformAdmin } from '../platform-auth/decorators/get-platform-admin.decorator';
import { PlatformAdminGuard } from '../platform-auth/guards/platform-admin.guard';
import { ActivePlatformAdmin } from '../platform-auth/interfaces/active-platform-admin.interface';
import { PrismaService } from '../prisma/prisma.service';
import { GrantCompDto } from './dto/grant-comp.dto';
import { RevokeCompDto } from './dto/revoke-comp.dto';
import {
  COMP_PLAN_LABELS,
  COMP_PLAN_MODULES,
  TRIAL_PLAN_KEY,
  compPlanAiEnabled,
  compPlanOf,
  isCompPlanKey,
} from './comp-plan.constants';
import { SubscriptionProvisioningService } from './subscription-provisioning.service';
import { PendingCompService } from './pending-comp.service';
import { isCompActive } from './comp.util';

/**
 * Complimentary plan access, granted by the platform owner.
 *
 * Separate from BillingController because the audience is different: that one
 * serves a tenant looking at their own account, this one serves whoever runs
 * the platform, acting across tenants. Hence PlatformAdminGuard rather than the
 * tenant-scoped PermissionGuard -- a tenant admin holds `billing.manage` for
 * their own account and must never be able to comp it.
 *
 * Comps grant plan access only. Credits are a separate balance with its own
 * purchase path, and nothing here touches it: a comped tenant still buys
 * their own credits to run searches.
 */
@UseGuards(PlatformAdminGuard)
@Controller('platform/comps')
export class CompController {
  private readonly logger = new Logger(CompController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly provisioning: SubscriptionProvisioningService,
    private readonly pendingComps: PendingCompService,
  ) {}

  /** Every tenant currently on complimentary access, newest first. */
  @Get()
  async list() {
    const rows = await this.prisma.tenantSubscription.findMany({
      // Grants queued behind a paid plan sit on a row that is still STRIPE, so
      // matching on source alone would hide them until they start -- and a
      // grant nobody can see is a grant nobody can cancel.
      where: {
        OR: [{ source: 'COMP' }, { pendingCompPlan: { not: null } }],
      },
      select: {
        tenantId: true,
        status: true,
        source: true,
        aiEnabled: true,
        compExpiresAt: true,
        compPlan: true,
        compReason: true,
        compGrantedBy: true,
        pendingCompPlan: true,
        pendingCompStartsAt: true,
        pendingCompDays: true,
        pendingCompReason: true,
        pendingCompGrantedBy: true,
        updatedAt: true,
        tenant: { select: { name: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return rows.map((row) => {
      const granted = compPlanOf(row);
      const queued = row.pendingCompPlan
        ? (isCompPlanKey(row.pendingCompPlan) ? row.pendingCompPlan : null)
        : null;

      if (queued) {
        return {
          tenantId: row.tenantId,
          tenantName: row.tenant?.name ?? null,
          // Not active: the tenant is still on their paid plan. The screen
          // lists these separately as "starting later".
          active: false,
          status: row.status,
          aiEnabled: compPlanAiEnabled(queued),
          plan: queued === TRIAL_PLAN_KEY ? 'TRIAL' : 'COMP',
          // The plan actually granted, by name. `plan` above is only the kind
          // of grant, which is all the screen used to have -- so a queued
          // Complete and a queued Operations both read as "Comped".
          planKey: queued,
          planName: COMP_PLAN_LABELS[queued],
          // The term is counted from activation, so there is no expiry date to
          // report yet -- only how long it will run for once it starts.
          expiresAt: null,
          scheduled: true,
          startsAt: row.pendingCompStartsAt,
          days: row.pendingCompDays,
          reason: row.pendingCompReason,
          grantedBy: row.pendingCompGrantedBy,
          updatedAt: row.updatedAt,
        };
      }

      return {
        tenantId: row.tenantId,
        tenantName: row.tenant?.name ?? null,
        // Lapsed and revoked comps stay in the list rather than vanishing:
        // "who did we give this to" is the question this endpoint exists to
        // answer, and it does not stop being asked when the comp ends.
        active: isCompActive(row),
        status: row.status,
        // A comp with AI off is a Trial plan; with AI on it is a comped paid
        // plan. The screen labels the row from this.
        aiEnabled: row.aiEnabled,
        plan: row.aiEnabled ? 'COMP' : 'TRIAL',
        // Which plan, by name -- "Comped" alone never said whether the tenant
        // was given Operations or the whole product. Null for a legacy row
        // whose plan cannot be recovered; the screen then falls back to the
        // kind of grant.
        planKey: granted,
        planName: granted ? COMP_PLAN_LABELS[granted] : null,
        expiresAt: row.compExpiresAt,
        scheduled: false,
        startsAt: null,
        days: null,
        reason: row.compReason,
        grantedBy: row.compGrantedBy,
        updatedAt: row.updatedAt,
      };
    });
  }

  @Post('grant')
  async grant(
    @GetPlatformAdmin() admin: ActivePlatformAdmin,
    @Body() dto: GrantCompDto,
  ) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: dto.tenantId },
      select: { id: true, name: true },
    });

    if (!tenant) {
      throw new NotFoundException('No such tenant.');
    }

    // A tenant inside a paid period they have already been charged for keeps
    // it. Applying a free plan now would downgrade them mid-period -- a Trial
    // grant switches AI off, flips the row to COMP, and the webhook then stops
    // writing to them while Stripe carries on billing. The grant is parked
    // instead and starts when the paid plan ends.
    //
    // No opt-out flag: comping over a live paid plan immediately has no
    // legitimate use, and offering it as a choice would mostly be a way to do
    // it by accident. Cancel the subscription first to make it immediate.
    const paid = await this.pendingComps.livePaidPlan(tenant.id);
    if (paid) {
      const pending = await this.pendingComps.schedule({
        tenantId: tenant.id,
        plan: dto.package,
        startsAt: paid.endsAt,
        days: dto.expiresInDays ?? null,
        reason: dto.reason,
        grantedBy: admin.adminId,
      });

      this.logger.log(
        `Queued ${COMP_PLAN_LABELS[dto.package]} for ${tenant.name ?? tenant.id} ` +
          `behind their paid plan, starting ` +
          `${paid.endsAt?.toISOString() ?? 'when it ends'} (by ${admin.adminId}).`,
      );

      return {
        tenantId: tenant.id,
        package: dto.package,
        aiEnabled: compPlanAiEnabled(dto.package),
        // Not active yet, so there is no expiry date to report: the term is
        // counted from activation (see PendingCompService.activate).
        expiresAt: null,
        scheduled: true,
        startsAt: pending.startsAt,
        summary: null,
      };
    }

    const expiresAt = dto.expiresInDays
      ? new Date(Date.now() + dto.expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    const aiEnabled = compPlanAiEnabled(dto.package);

    const summary = await this.provisioning.provision({
      tenantId: tenant.id,
      modules: COMP_PLAN_MODULES[dto.package],
      status: 'ACTIVE',
      source: 'COMP',
      aiEnabled,
      compExpiresAt: expiresAt,
      compPlan: dto.package,
      compReason: dto.reason,
      compGrantedBy: admin.adminId,
      reason: `comp:${COMP_PLAN_LABELS[dto.package]}`,
    });

    this.logger.log(
      `Comped ${tenant.name ?? tenant.id} onto ${COMP_PLAN_LABELS[dto.package]} ` +
        `(AI ${aiEnabled ? 'on' : 'off'}) ` +
        `until ${expiresAt?.toISOString() ?? 'further notice'} (by ${admin.adminId}).`,
    );

    return {
      tenantId: tenant.id,
      package: dto.package,
      aiEnabled,
      expiresAt,
      scheduled: false,
      startsAt: null,
      summary,
    };
  }

  @Post('revoke')
  async revoke(
    @GetPlatformAdmin() admin: ActivePlatformAdmin,
    @Body() dto: RevokeCompDto,
  ) {
    const subscription = await this.prisma.tenantSubscription.findUnique({
      where: { tenantId: dto.tenantId },
      select: { source: true },
    });

    if (!subscription) {
      throw new NotFoundException('No such tenant.');
    }

    // A grant queued behind a paid plan is revoked by dropping the queue entry.
    // Running the normal revoke would provision the tenant down to no modules
    // -- cutting off the paid plan they are still inside, from an endpoint
    // meant to take away free access. Checked before the source test below,
    // because a queued grant sits on a row that is still STRIPE.
    if (await this.pendingComps.cancel(dto.tenantId)) {
      this.logger.log(
        `Cancelled the queued comp for ${dto.tenantId} (by ${admin.adminId}).`,
      );
      return { tenantId: dto.tenantId, wasScheduled: true, summary: null };
    }

    // Revoking something Stripe owns would cancel a paying customer from an
    // endpoint meant for free access. Refuse rather than guess.
    if (subscription.source !== 'COMP') {
      throw new NotFoundException(
        'That tenant is not on complimentary access.',
      );
    }

    const summary = await this.provisioning.revokeComp(
      dto.tenantId,
      admin.adminId,
      dto.reason,
    );

    this.logger.log(`Revoked comp for ${dto.tenantId} (by ${admin.adminId}).`);

    return { tenantId: dto.tenantId, wasScheduled: false, summary };
  }
}
