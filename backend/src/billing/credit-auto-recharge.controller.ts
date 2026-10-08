import { Body, Controller, Get, Post, Put, Query, UseGuards } from '@nestjs/common';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ModuleGuard } from '../auth/guards/module.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { RequireModule } from '../auth/decorators/module.decorator';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { AuditService } from '../audit/audit.service';
import { CreditAutoRechargeService } from './credit-auto-recharge.service';
import { StripeService } from './stripe.service';
import { UpdateAutoRechargeDto } from './dto/update-auto-recharge.dto';
import { AttachAutoRechargeCardDto } from './dto/attach-auto-recharge-card.dto';
import { CREDIT_PACKS, CreditPackKey } from './credit-packs.constants';

/**
 * Auto-recharge settings for Prospect Search credits.
 *
 * Gated on LEAD_GEN like the rest of the credits surface, and on
 * billing.manage throughout: this authorises charges to a saved card, so
 * reading it is as sensitive as changing it.
 */
@UseGuards(JwtAuthGuard, PermissionGuard, ModuleGuard)
@RequireModule('LEAD_GEN')
@Controller('billing/credits/auto-recharge')
export class CreditAutoRechargeController {
  constructor(
    private readonly autoRecharge: CreditAutoRechargeService,
    private readonly stripe: StripeService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Current settings. Returns the saved card's brand and last 4 only -- never
   * a payment method id, which is a handle to charging the card.
   */
  @Get()
  @RequirePermission('billing.manage')
  async get(@GetUser() user: ActiveUser) {
    const config = await this.autoRecharge.getConfig(user.tenantId);
    if (!config) {
      return { configured: false, packs: this.packSummaries() };
    }

    return {
      configured: true,
      enabled: config.enabled,
      thresholdCredits: config.thresholdCredits,
      packKey: config.packKey,
      monthlyCapAmount: config.monthlyCapAmount,
      hasCard: !!config.stripePaymentMethodId,
      card: config.stripePaymentMethodId
        ? { brand: config.cardBrand, last4: config.cardLast4 }
        : null,
      paused: !!config.pausedAt,
      pauseReason: config.pauseReason,
      pausedAt: config.pausedAt,
      lastRechargeAt: config.lastRechargeAt,
      monthlySpend: await this.autoRecharge.monthlySpend(config.id),
      packs: this.packSummaries(),
    };
  }

  @Put()
  @RequirePermission('billing.manage')
  async update(
    @GetUser() user: ActiveUser,
    @Body() dto: UpdateAutoRechargeDto,
  ) {
    const config = await this.autoRecharge.upsertConfig(user.tenantId, {
      enabled: dto.enabled,
      thresholdCredits: dto.thresholdCredits,
      packKey: dto.packKey,
      monthlyCapAmount: dto.monthlyCapAmount ?? null,
    });

    // Audited because it authorises unattended charges: who turned this on,
    // with what limits, is the first question in any billing dispute.
    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.sub,
      action: 'AUTO_RECHARGE_UPDATED',
      entityType: 'CREDITS',
      details: `${
        dto.enabled ? 'Enabled' : 'Disabled'
      } auto-recharge: buy ${dto.packKey} when the balance falls to ${
        dto.thresholdCredits
      } credits; monthly cap ${dto.monthlyCapAmount ?? 'none'}.`,
    });

    return {
      enabled: config.enabled,
      thresholdCredits: config.thresholdCredits,
      packKey: config.packKey,
      monthlyCapAmount: config.monthlyCapAmount,
      hasCard: !!config.stripePaymentMethodId,
    };
  }

  /**
   * Starts the hosted card-entry flow. Saves a card without charging it --
   * enabling auto-recharge authorises future charges, it is not a purchase.
   */
  @Post('card/session')
  @RequirePermission('billing.manage')
  createCardSession(@GetUser() user: ActiveUser) {
    return this.stripe.createCardSetupSession({
      tenantId: user.tenantId,
      email: user.email,
    });
  }

  /** Records the card once the tenant finishes the hosted flow. */
  @Post('card')
  @RequirePermission('billing.manage')
  async attachCard(
    @GetUser() user: ActiveUser,
    @Body() dto: AttachAutoRechargeCardDto,
  ) {
    const config = await this.autoRecharge.attachCardFromSetupSession(
      user.tenantId,
      dto.sessionId,
    );

    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.sub,
      action: 'AUTO_RECHARGE_CARD_ATTACHED',
      entityType: 'CREDITS',
      details: `Saved ${config.cardBrand ?? 'card'} ending ${
        config.cardLast4 ?? '????'
      } for automatic top-ups.`,
    });

    return {
      hasCard: !!config.stripePaymentMethodId,
      card: { brand: config.cardBrand, last4: config.cardLast4 },
      paused: !!config.pausedAt,
      pauseReason: config.pauseReason,
    };
  }

  /** Clears a pause after the tenant has fixed whatever caused it. */
  @Post('resume')
  @RequirePermission('billing.manage')
  async resume(@GetUser() user: ActiveUser) {
    const config = await this.autoRecharge.resume(user.tenantId);

    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.sub,
      action: 'AUTO_RECHARGE_RESUMED',
      entityType: 'CREDITS',
      details: 'Cleared the auto-recharge pause.',
    });

    return { paused: !!config.pausedAt, enabled: config.enabled };
  }

  /** Attempt history, so a tenant can see every automatic charge. */
  @Get('attempts')
  @RequirePermission('billing.manage')
  attempts(@GetUser() user: ActiveUser, @Query('limit') limit?: string) {
    const parsed = Number(limit);
    return this.autoRecharge.recentAttempts(
      user.tenantId,
      Number.isFinite(parsed) && parsed > 0 ? parsed : undefined,
    );
  }

  /** Pack choices, so the UI can show what each threshold buys. */
  private packSummaries() {
    return (Object.keys(CREDIT_PACKS) as CreditPackKey[]).map((key) => ({
      key,
      label: CREDIT_PACKS[key].label,
      credits: CREDIT_PACKS[key].credits,
      price: CREDIT_PACKS[key].price,
    }));
  }
}
