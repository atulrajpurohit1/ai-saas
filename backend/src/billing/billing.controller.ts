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

@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('billing')
export class BillingController {
  constructor(
    private readonly billingService: BillingService,
    private readonly stripe: StripeService,
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
