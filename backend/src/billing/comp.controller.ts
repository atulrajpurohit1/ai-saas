import {
  Body,
  Controller,
  Get,
  Logger,
  NotFoundException,
  Post,
  UseGuards,
} from '@nestjs/common';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SuperAdminGuard } from '../auth/guards/super-admin.guard';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import { GrantCompDto } from './dto/grant-comp.dto';
import { RevokeCompDto } from './dto/revoke-comp.dto';
import {
  COMP_PLAN_LABELS,
  COMP_PLAN_MODULES,
  compPlanAiEnabled,
} from './comp-plan.constants';
import { SubscriptionProvisioningService } from './subscription-provisioning.service';
import { isCompActive } from './comp.util';

/**
 * Complimentary plan access, granted by the platform owner.
 *
 * Separate from BillingController because the audience is different: that one
 * serves a tenant looking at their own account, this one serves whoever runs
 * the platform, acting across tenants. Hence SuperAdminGuard rather than the
 * tenant-scoped PermissionGuard -- a tenant admin holds `billing.manage` for
 * their own account and must never be able to comp it.
 *
 * Comps grant plan access only. Credits are a separate balance with its own
 * purchase path, and nothing here touches it: a comped tenant still buys
 * their own credits to run searches.
 */
@UseGuards(JwtAuthGuard, SuperAdminGuard)
@Controller('platform/comps')
export class CompController {
  private readonly logger = new Logger(CompController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly provisioning: SubscriptionProvisioningService,
  ) {}

  /** Every tenant currently on complimentary access, newest first. */
  @Get()
  async list() {
    const rows = await this.prisma.tenantSubscription.findMany({
      where: { source: 'COMP' },
      select: {
        tenantId: true,
        status: true,
        source: true,
        aiEnabled: true,
        compExpiresAt: true,
        compReason: true,
        compGrantedBy: true,
        updatedAt: true,
        tenant: { select: { name: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return rows.map((row) => ({
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
      expiresAt: row.compExpiresAt,
      reason: row.compReason,
      grantedBy: row.compGrantedBy,
      updatedAt: row.updatedAt,
    }));
  }

  @Post('grant')
  async grant(@GetUser() user: ActiveUser, @Body() dto: GrantCompDto) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: dto.tenantId },
      select: { id: true, name: true },
    });

    if (!tenant) {
      throw new NotFoundException('No such tenant.');
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
      compReason: dto.reason,
      compGrantedBy: user.sub,
      reason: `comp:${COMP_PLAN_LABELS[dto.package]}`,
    });

    this.logger.log(
      `Comped ${tenant.name ?? tenant.id} onto ${COMP_PLAN_LABELS[dto.package]} ` +
        `(AI ${aiEnabled ? 'on' : 'off'}) ` +
        `until ${expiresAt?.toISOString() ?? 'further notice'} (by ${user.sub}).`,
    );

    return {
      tenantId: tenant.id,
      package: dto.package,
      aiEnabled,
      expiresAt,
      summary,
    };
  }

  @Post('revoke')
  async revoke(@GetUser() user: ActiveUser, @Body() dto: RevokeCompDto) {
    const subscription = await this.prisma.tenantSubscription.findUnique({
      where: { tenantId: dto.tenantId },
      select: { source: true },
    });

    if (!subscription) {
      throw new NotFoundException('No such tenant.');
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
      user.sub,
      dto.reason,
    );

    this.logger.log(`Revoked comp for ${dto.tenantId} (by ${user.sub}).`);

    return { tenantId: dto.tenantId, summary };
  }
}
