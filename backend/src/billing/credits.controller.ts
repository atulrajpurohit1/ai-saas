import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { CreditEntryType } from '@prisma/client';
import {
  RequireAnyPermission,
  RequirePermission,
} from '../auth/decorators/permissions.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ModuleGuard } from '../auth/guards/module.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { RequireModule } from '../auth/decorators/module.decorator';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { AuditService } from '../audit/audit.service';
import { isCheckoutConfigured } from './billing.config';
import {
  discoveryCreditCost,
  playbookCreditCost,
  sellableCreditPacks,
} from './credit-packs.constants';
import { CreditsService } from './credits.service';
import { GrantCreditsDto } from './dto/grant-credits.dto';
import { PurchaseCreditsDto } from './dto/purchase-credits.dto';
import { StripeService } from './stripe.service';

/**
 * Credits only ever pay for Prospect Search, which is part of AegisLead
 * Generation. Gating the whole controller on LEAD_GEN means a tenant without
 * that service cannot buy credits they would then be refused permission to
 * spend -- which would otherwise be a completed Stripe payment we had to refund
 * by hand.
 */
@UseGuards(JwtAuthGuard, PermissionGuard, ModuleGuard)
@RequireModule('LEAD_GEN')
@Controller('billing/credits')
export class CreditsController {
  constructor(
    private readonly credits: CreditsService,
    private readonly stripe: StripeService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Current balance. Read permission is deliberately wide -- anyone who can run
   * a search needs to see what it will cost them before they run it.
   */
  @Get()
  @RequireAnyPermission(
    'billing.view',
    'prospect_search.view',
    'roles.view',
    'users.view',
  )
  getBalance(@GetUser() user: ActiveUser) {
    return this.credits.getBalance(user.tenantId);
  }

  /** Packs on sale, and what each unit of work costs. */
  @Get('packs')
  @RequireAnyPermission('billing.view', 'prospect_search.view', 'users.view')
  getPacks() {
    return {
      configured: isCheckoutConfigured(),
      packs: sellableCreditPacks(),
      // Shown to the customer so the cost of a search is never a surprise.
      // Both are now flat per search. `perProspect` is retained, always null,
      // so an older frontend build that reads it renders nothing rather than
      // crashing or quoting a per-prospect price that no longer exists.
      costs: {
        playbook: playbookCreditCost(),
        discoverySearch: discoveryCreditCost(),
        perProspect: null,
      },
    };
  }

  @Get('ledger')
  @RequireAnyPermission('billing.view', 'users.view')
  getLedger(@GetUser() user: ActiveUser, @Query('limit') limit?: string) {
    const parsed = Number.parseInt(limit ?? '', 10);
    return this.credits.getLedger(
      user.tenantId,
      Number.isFinite(parsed) ? parsed : 50,
    );
  }

  /** Starts a Stripe one-off checkout for a credit pack. */
  @Post('checkout/session')
  @RequirePermission('billing.manage')
  purchase(@GetUser() user: ActiveUser, @Body() dto: PurchaseCreditsDto) {
    return this.stripe.createCreditPackCheckoutSession({
      tenantId: user.tenantId,
      pack: dto.pack,
      email: user.email,
    });
  }

  /**
   * Manual adjustment, for support cases. Audited because it moves money-
   * equivalent value without a Stripe payment behind it.
   */
  @Post('grant')
  @RequirePermission('billing.manage')
  async grant(@GetUser() user: ActiveUser, @Body() dto: GrantCreditsDto) {
    const result = await this.credits.grant({
      tenantId: user.tenantId,
      amount: dto.amount,
      description: dto.reason,
      userId: user.sub,
      type: CreditEntryType.ADJUSTMENT,
    });

    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.sub,
      action: 'CREDITS_ADJUSTED',
      entityType: 'CREDITS',
      details: `${dto.amount > 0 ? '+' : ''}${dto.amount} credits: ${
        dto.reason
      } (balance now ${result.balance})`,
    });

    return result;
  }
}
