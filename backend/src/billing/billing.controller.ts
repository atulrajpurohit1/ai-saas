import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Logger,
  Post,
  UseGuards,
} from '@nestjs/common';
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
import { isCheckoutConfigured } from './billing.config';
import { GuardMeteringService } from './guard-metering.service';
import {
  GENERATION_ONLY_BAND,
  GUARD_BANDS,
  GuardBand,
  MONTHLY_PRICES,
  PACKAGE_KEYS,
  PACKAGE_LABELS,
  PACKAGE_MODULES,
  PackageKey,
  bandForGuardCount,
  bandRank,
  planForLookupKey,
} from './pricing.constants';

@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('billing')
export class BillingController {
  private readonly logger = new Logger(BillingController.name);

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
  async checkoutAvailability() {
    const plans = await this.sellablePlansOrNone();
    return {
      configured:
        isCheckoutConfigured() &&
        Object.values(plans).some((bands) => bands.length > 0),
      plans,
    };
  }

  /**
   * Everything the plan page needs in one call: the published table, which
   * cells can be bought online, the lowest band this tenant may pick, and the
   * plan they are on now.
   */
  @Get('plan')
  @RequireAnyPermission('billing.view', 'roles.view', 'users.view')
  async plan(@GetUser() user: ActiveUser) {
    const [plans, activeGuards, current] = await Promise.all([
      this.sellablePlansOrNone(),
      this.metering.activeGuardCount(user.tenantId),
      this.currentPlan(user.tenantId),
    ]);

    return {
      configured:
        isCheckoutConfigured() &&
        Object.values(plans).some((bands) => bands.length > 0),
      bands: GUARD_BANDS,
      packages: PACKAGE_KEYS.map((key) => ({
        key,
        name: PACKAGE_LABELS[key],
        modules: PACKAGE_MODULES[key],
        monthly: MONTHLY_PRICES[key],
        sellableBands: plans[key] ?? [],
      })),
      generationOnlyBand: GENERATION_ONLY_BAND,
      activeGuards,
      minimumBand: bandForGuardCount(activeGuards),
      current,
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
  async createCheckoutSession(
    @GetUser() user: ActiveUser,
    @Body() dto: CreateCheckoutSessionDto,
  ) {
    const band = await this.billableBandFor(
      user.tenantId,
      dto.package,
      dto.band,
    );

    return this.stripe.createPlanCheckoutSession({
      tenantId: user.tenantId,
      packageKey: dto.package,
      band,
      email: user.email,
    });
  }

  /** Stripe-hosted page for cards, invoices, plan changes and cancellation. */
  @Post('portal/session')
  @RequirePermission('billing.manage')
  createPortalSession(@GetUser() user: ActiveUser) {
    return this.stripe.createPortalSession(user.tenantId);
  }

  /**
   * The band a purchase is actually charged at.
   *
   * Generation on its own is a flat price whatever the headcount (confirmed
   * with the client), so it is always sold at the base band. Every other
   * package follows the band the customer picks, but never one below the
   * guards they are actually running: picking a lower row of the table than
   * your own rota would be choosing your own discount.
   */
  private async billableBandFor(
    tenantId: string,
    packageKey: PackageKey,
    requested: GuardBand,
  ): Promise<GuardBand> {
    if (packageKey === 'GENERATION') return GENERATION_ONLY_BAND;

    const activeGuards = await this.metering.activeGuardCount(tenantId);
    const minimum = bandForGuardCount(activeGuards);
    if (bandRank(requested) < bandRank(minimum)) {
      throw new BadRequestException(
        `Your account runs ${activeGuards} active guards, so the lowest band you can choose is ${minimum}.`,
      );
    }
    return requested;
  }

  /**
   * Plan cells that can be bought online. A Stripe outage must not take the
   * plan page down with it, so a failure here reads as "nothing sellable" and
   * the page offers the contact route instead.
   */
  private async sellablePlansOrNone(): Promise<
    Record<PackageKey, GuardBand[]>
  > {
    try {
      return await this.stripe.sellablePlans();
    } catch (error) {
      this.logger.warn(
        `Could not read plan prices from Stripe: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return Object.fromEntries(
        PACKAGE_KEYS.map((key) => [key, [] as GuardBand[]]),
      ) as Record<PackageKey, GuardBand[]>;
    }
  }

  /** The package and band the tenant's Stripe subscription is on, if any. */
  private async currentPlan(tenantId: string) {
    if (!isCheckoutConfigured()) return null;
    try {
      return planForLookupKey(await this.stripe.currentPlanLookupKey(tenantId));
    } catch {
      return null;
    }
  }
}
