import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import {
  RequireAnyPermission,
  RequirePermission,
} from '../auth/decorators/permissions.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { BillingService } from './billing.service';
import { StripeService } from './stripe.service';
import { CreateCheckoutSessionDto } from './dto/create-checkout-session.dto';
import { isCheckoutConfigured, sellableModules } from './billing.config';
import { GuardMeteringService } from './guard-metering.service';
import {
  GUARD_BANDS,
  MONTHLY_PRICES,
  PACKAGE_LABELS,
  PACKAGE_MODULES,
} from './pricing.constants';

@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('billing')
export class BillingController {
  constructor(
    private readonly billingService: BillingService,
    private readonly stripe: StripeService,
    private readonly metering: GuardMeteringService,
  ) {}

  @Get()
  @RequireAnyPermission('billing.view', 'roles.view', 'users.view')
  getBilling(@GetUser() user: ActiveUser) {
    return this.billingService.getTenantBilling(user.tenantId);
  }

  /**
   * Lets the plan page know whether to show "Add service" buttons at all.
   * Until pricing is configured this reports false, and the UI falls back to
   * a contact-us prompt rather than a button that 503s.
   */
  @Get('checkout/availability')
  @RequireAnyPermission('billing.view', 'roles.view', 'users.view')
  checkoutAvailability() {
    return {
      configured: isCheckoutConfigured(),
      monthly: sellableModules('monthly'),
      annual: sellableModules('annual'),
    };
  }

  /** The published price table, for the pricing and plan pages. */
  @Get('pricing')
  @RequireAnyPermission('billing.view', 'roles.view', 'users.view')
  pricing() {
    return {
      bands: GUARD_BANDS,
      packages: Object.entries(PACKAGE_LABELS).map(([key, name]) => ({
        key,
        name,
        modules: PACKAGE_MODULES[key as keyof typeof PACKAGE_MODULES],
        monthly: MONTHLY_PRICES[key as keyof typeof MONTHLY_PRICES],
      })),
    };
  }

  /**
   * What this tenant is billed at right now -- package, guard band and price.
   * Also reports the total guard count, so a customer can see why they sit in
   * the band they do.
   */
  @Get('usage')
  @RequireAnyPermission('billing.view', 'roles.view', 'users.view')
  usage(@GetUser() user: ActiveUser) {
    return this.metering.billingProfile(user.tenantId);
  }

  @Post('checkout/session')
  @RequirePermission('billing.manage')
  createCheckoutSession(
    @GetUser() user: ActiveUser,
    @Body() dto: CreateCheckoutSessionDto,
  ) {
    return this.stripe.createCheckoutSession({
      tenantId: user.tenantId,
      modules: dto.modules,
      interval: dto.interval ?? 'monthly',
      email: user.email,
    });
  }

  /** Stripe-hosted page for cards, invoices, plan changes and cancellation. */
  @Post('portal/session')
  @RequirePermission('billing.manage')
  createPortalSession(@GetUser() user: ActiveUser) {
    return this.stripe.createPortalSession(user.tenantId);
  }
}
