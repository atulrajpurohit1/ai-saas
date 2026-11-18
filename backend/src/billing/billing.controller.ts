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
import { EntitlementsService } from '../entitlements/entitlements.service';
import {
  GENERATION_ONLY_BAND,
  GUARD_BANDS,
  GUARD_BAND_PACKAGE_KEYS,
  GuardBand,
  MONTHLY_PRICES,
  PACKAGE_KEYS,
  PACKAGE_LABELS,
  PACKAGE_MODULES,
  PackageKey,
  bandForGuardCount,
  bandRank,
  billableBand,
  resolvePackageForModules,
  planForLookupKey,
} from './pricing.constants';
import {
  LEAD_GEN_BASE_PRICE,
  LEAD_GEN_TIERS,
  LEAD_GEN_TIER_KEYS,
  LeadGenTierKey,
  leadGenTierForLookupKey,
} from './lead-gen-tiers.constants';
import { PrismaService } from '../prisma/prisma.service';
import { TRIAL_PLAN_KEY, compPlanOf } from './comp-plan.constants';
import { isCompActive } from './comp.util';

@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('billing')
export class BillingController {
  private readonly logger = new Logger(BillingController.name);

  constructor(
    private readonly billingService: BillingService,
    private readonly stripe: StripeService,
    private readonly metering: GuardMeteringService,
    private readonly entitlements: EntitlementsService,
    private readonly prisma: PrismaService,
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
    const [plans, leadGen, billableGuards, current, hasHadLeadGen] =
      await Promise.all([
        this.sellablePlansOrNone(),
        this.sellableLeadGenOrNone(),
        this.metering.billableGuardCount(user.tenantId),
        this.currentPlan(user.tenantId),
        this.hasHeldLeadGen(user.tenantId),
      ]);
    const leadGenTiers = leadGen.tiers;

    return {
      configured:
        isCheckoutConfigured() &&
        (Object.values(plans).some((bands) => bands.length > 0) ||
          leadGenTiers.length > 0),
      bands: GUARD_BANDS,
      // Only the packages actually priced by guards. Lead Gen is sold as the
      // flat tiers below and is no longer a column of this table.
      packages: GUARD_BAND_PACKAGE_KEYS.map((key) => ({
        key,
        name: PACKAGE_LABELS[key],
        modules: PACKAGE_MODULES[key],
        monthly: MONTHLY_PRICES[key],
        sellableBands: plans[key] ?? [],
      })),
      leadGen: {
        name: PACKAGE_LABELS.GENERATION,
        modules: PACKAGE_MODULES.GENERATION,
        basePrice: LEAD_GEN_BASE_PRICE,
        tiers: LEAD_GEN_TIER_KEYS.map((key) => LEAD_GEN_TIERS[key]),
        sellableTiers: leadGenTiers,
        currentTier: current?.leadGenTier ?? null,
        /**
         * Whether the base plan -- the platform fee with no credits -- may be
         * bought. A tenant that has never held Lead Gen cannot: a starting
         * plan is the only way in, so nobody lands on the product with an
         * empty balance. Enforced again on the checkout route; this flag only
         * decides what the page offers.
         */
        baseSellable: leadGen.base && hasHadLeadGen,
        /** Why the base plan is not on offer, for the page to explain. */
        baseRequiresPlan: !hasHadLeadGen,
        /**
         * Already running Lead Gen on the base plan -- the flat $299 with no
         * credits, which is also where every pre-tier Generation customer
         * sits. The page says so rather than showing three starting plans
         * none of which they appear to be on.
         */
        onBasePlan: current?.onBasePlan ?? false,
      },
      generationOnlyBand: GENERATION_ONLY_BAND,
      billableGuards,
      minimumBand: bandForGuardCount(billableGuards),
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
    if (dto.package === 'GENERATION') {
      // Lead Gen rides alongside Guard or Operations, but Complete already
      // contains it. Selling it to a Complete customer would add a second
      // charge for a product they are already paying for.
      const modules = [
        ...(await this.entitlements.modulesForTenant(user.tenantId)),
      ];
      if (resolvePackageForModules(modules).packageKey === 'COMPLETE') {
        throw new BadRequestException(
          `${PACKAGE_LABELS.COMPLETE} already includes Lead Gen. Buy credits ` +
            'instead of a second plan.',
        );
      }

      // The base Lead Gen plan carries no credits, so it is only for a tenant
      // that already has some history with the product. A first-time buyer
      // must take a starting plan: otherwise they would arrive on Lead Gen
      // with an empty balance, unable to run a single search until they
      // bought credits separately -- a product that does nothing on the day
      // it is paid for.
      if (!dto.tier && !(await this.hasHeldLeadGen(user.tenantId))) {
        throw new BadRequestException(
          'Choose a Lead Gen plan: Starter, Pro or Elite. Each one includes ' +
            'credits to start with, and they do not expire.',
        );
      }
    }

    const band = await this.billableBandFor(
      user.tenantId,
      dto.package,
      dto.band,
    );

    return this.stripe.createPlanCheckoutSession({
      tenantId: user.tenantId,
      packageKey: dto.package,
      band,
      tier: dto.tier,
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

    const billableGuards = await this.metering.billableGuardCount(tenantId);
    const minimum = bandForGuardCount(billableGuards);
    if (bandRank(requested) < bandRank(minimum)) {
      throw new BadRequestException(
        `Your account has ${billableGuards} guards, so the lowest band you can choose is ${minimum}.`,
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

  /** Lead Gen plans that can be bought online, or none if Stripe is down. */
  private async sellableLeadGenOrNone(): Promise<{
    tiers: LeadGenTierKey[];
    base: boolean;
  }> {
    try {
      const [tiers, base] = await Promise.all([
        this.stripe.sellableLeadGenTiers(),
        this.stripe.leadGenBaseSellable(),
      ]);
      return { tiers, base };
    } catch (error) {
      this.logger.warn(
        `Could not read Lead Gen prices from Stripe: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return { tiers: [], base: false };
    }
  }

  /**
   * Has this tenant ever held Lead Gen?
   *
   * Module rows are deactivated rather than deleted when a plan ends (see
   * SubscriptionProvisioningService.provision), so the row's existence is a
   * permanent record that Lead Gen was once provisioned here -- which is
   * exactly the question the base plan turns on. A tenant that has never had
   * it must buy a starting plan, credits included; one that has can pay the
   * platform fee alone and top up credits when it suits them.
   */
  private async hasHeldLeadGen(tenantId: string): Promise<boolean> {
    const row = await this.prisma.tenantModule.findFirst({
      where: { tenantId, module: 'LEAD_GEN' },
      select: { id: true },
    });
    return row !== null;
  }

  /**
   * The package and band the tenant is currently on.
   *
   * Stripe is asked first, because a real subscription knows the exact band
   * that is being charged. But a tenant can hold modules without any Stripe
   * subscription -- demo accounts, comped accounts and anything provisioned by
   * hand -- and those are on a plan just as much as a paying customer is.
   * Reporting null for them made the plan page offer "Get started" on the
   * package they already had, inviting a customer to pay for what they were
   * already using. So fall back to the modules actually granted.
   */
  private async currentPlan(tenantId: string): Promise<{
    packageKey: PackageKey;
    band: GuardBand;
    leadGenTier?: LeadGenTierKey;
    /** Lead Gen at the platform fee, with no credits included. */
    onBasePlan?: boolean;
  } | null> {
    if (isCheckoutConfigured()) {
      try {
        // A subscription can carry two lines: a guard-banded package and a
        // Lead Gen one. They are read separately rather than "the first item
        // wins", which would report a Guard customer's Lead Gen add-on as
        // their whole plan.
        const keys = await this.stripe.currentPlanLookupKeys(tenantId);

        let banded: { packageKey: PackageKey; band: GuardBand } | null = null;
        let leadGenTier: LeadGenTierKey | undefined;
        let onBasePlan = false;

        for (const key of keys) {
          const tier = leadGenTierForLookupKey(key);
          if (tier) {
            leadGenTier = tier.key;
            continue;
          }

          const plan = planForLookupKey(key);
          if (!plan) continue;
          // Lead Gen's base plan is sold under the Generation base band.
          if (plan.packageKey === 'GENERATION') onBasePlan = true;
          else banded = plan;
        }

        if (banded) return { ...banded, leadGenTier, onBasePlan };
        if (leadGenTier || onBasePlan) {
          return {
            packageKey: 'GENERATION',
            band: GENERATION_ONLY_BAND,
            leadGenTier,
            onBasePlan: onBasePlan && !leadGenTier,
          };
        }
      } catch {
        // Fall through to the entitlement-derived plan below.
      }
    }

    // A comp records the plan it granted, so ask it before guessing from
    // modules. Without this a Trial tenant resolved to COMPLETE -- Trial
    // unlocks all three services, which is exactly the Complete module set --
    // and the plan page named their plan "AegisLead Complete".
    //
    // Trial itself is not a sellable package and has no band or price, so it
    // reports null: the page then offers the real packages, which is the right
    // thing to show someone on a trial.
    const comped = await this.prisma.tenantSubscription.findUnique({
      where: { tenantId },
      select: { source: true, status: true, compExpiresAt: true, compPlan: true, aiEnabled: true },
    });

    if (comped && isCompActive(comped)) {
      const plan = compPlanOf(comped);
      if (plan === TRIAL_PLAN_KEY) return null;
      if (plan) {
        const billableGuards = await this.metering.billableGuardCount(tenantId);
        return { packageKey: plan, band: billableBand(plan, billableGuards) };
      }
    }

    // Lead Gen is an add-on, so a tenant holding Guard Tour and Lead Gen is
    // on Guard -- not on nothing, which is what asking for an exact package
    // match used to report for that combination.
    const modules = [...(await this.entitlements.modulesForTenant(tenantId))];
    const { packageKey, leadGenAddOn } = resolvePackageForModules(modules);
    if (!packageKey) return null;

    const billableGuards = await this.metering.billableGuardCount(tenantId);
    return {
      packageKey,
      band: billableBand(packageKey, billableGuards),
      // Without Stripe there is no way to tell which Lead Gen plan they are
      // on, only that they have one. Reported as the base plan, since that is
      // the one that promises nothing about credits.
      onBasePlan: leadGenAddOn || packageKey === 'GENERATION',
    };
  }
}
