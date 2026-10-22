import { Injectable, Logger } from '@nestjs/common';
import {
  ServiceModule,
  SubscriptionSource,
  SubscriptionStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  SERVICE_MODULES,
  SERVICE_MODULE_LABELS,
  serviceForPermissionModule,
} from './entitlements.constants';
import { isCompActive } from '../billing/comp.util';
import {
  COMP_PLAN_LABELS,
  isCompPlanKey,
} from '../billing/comp-plan.constants';

/** Statuses that still grant access. PAST_DUE keeps working -- dunning is a
 *  billing conversation, not a reason to strand a paying customer mid-shift. */
const ACTIVE_STATUSES: SubscriptionStatus[] = ['ACTIVE', 'TRIALING', 'PAST_DUE'];

const CACHE_TTL_MS = 30_000;

type CacheEntry = { modules: Set<ServiceModule>; expiresAt: number };

@Injectable()
export class EntitlementsService {
  private readonly logger = new Logger(EntitlementsService.name);
  private readonly cache = new Map<string, CacheEntry>();
  private readonly aiCache = new Map<
    string,
    { enabled: boolean; expiresAt: number }
  >();

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Whether this tenant may use AI (Gemini) features right now.
   *
   * This is the gate behind the AegisLead Trial plan, whose whole promise is
   * "everything except the AI features". It is enforced here, in one place,
   * because AI features are spread across every module and funnel through two
   * call sites (the AI metering service and the prospect company-insight
   * endpoint) -- both consult this, so a single flag governs all of them.
   *
   * Fails CLOSED: no subscription, an inactive status, or a lapsed comp all
   * read as "no AI", the same shape the module read uses, so a broken state
   * withholds AI rather than leaking it. The 30s cache bounds how long a
   * just-flipped switch keeps its old answer, matching the module cache.
   */
  async isAiEnabled(tenantId: string): Promise<boolean> {
    if (!tenantId) return false;

    const cached = this.aiCache.get(tenantId);
    if (cached && cached.expiresAt > Date.now()) return cached.enabled;

    const subscription = await this.prisma.tenantSubscription.findUnique({
      where: { tenantId },
      select: {
        status: true,
        source: true,
        compExpiresAt: true,
        aiEnabled: true,
      },
    });

    const enabled = this.computeAiEnabled(subscription);
    this.aiCache.set(tenantId, {
      enabled,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
    return enabled;
  }

  private computeAiEnabled(
    subscription: {
      status: SubscriptionStatus;
      source: SubscriptionSource;
      compExpiresAt: Date | null;
      aiEnabled: boolean;
    } | null,
  ): boolean {
    // AI rides on top of having access at all: a tenant with no live
    // subscription has no AI either, regardless of the flag's stored value.
    if (!subscription) return false;
    if (!ACTIVE_STATUSES.includes(subscription.status)) return false;
    if (
      subscription.source === 'COMP' &&
      !isCompActive({
        source: subscription.source,
        status: subscription.status,
        compExpiresAt: subscription.compExpiresAt,
      })
    ) {
      return false;
    }
    // `!== false` rather than a bare read so a column that defaults to true is
    // treated as enabled even if a caller handed us a row without the field.
    return subscription.aiEnabled !== false;
  }

  async modulesForTenant(tenantId: string): Promise<Set<ServiceModule>> {
    if (!tenantId) return new Set();

    const cached = this.cache.get(tenantId);
    if (cached && cached.expiresAt > Date.now()) return cached.modules;

    const subscription = await this.prisma.tenantSubscription.findUnique({
      where: { tenantId },
      select: { status: true, source: true, compExpiresAt: true },
    });

    // No subscription row at all. Signup now creates one inside the same
    // transaction as the tenant, so by this point a missing row means either
    // a tenant predating that change or data corruption -- not a legitimate
    // state.
    //
    // This deliberately fails CLOSED. It used to grant every module, which
    // meant any tenant without a row silently received all three services
    // free; that is a revenue hole once Stripe is live, and it hid the bug
    // by making the broken case look like the working one. Locking instead
    // makes the failure loud and cheap to spot.
    //
    // Logged at error, not warn: nothing should reach this branch.
    if (!subscription) {
      this.logger.error(
        `Tenant ${tenantId} has no subscription row; denying all modules. ` +
          `This tenant needs a TenantSubscription row before it can be used.`,
      );
      return this.remember(tenantId, new Set());
    }

    if (!ACTIVE_STATUSES.includes(subscription.status)) {
      return this.remember(tenantId, new Set());
    }

    // A comp whose end date has passed grants nothing, even though its status
    // still reads ACTIVE. Checking here rather than trusting a job to flip the
    // status means a job that never ran cannot leave free access running on.
    // The 30s cache bounds how long a just-lapsed comp keeps working.
    if (
      subscription.source === 'COMP' &&
      !isCompActive({
        source: subscription.source,
        status: subscription.status,
        compExpiresAt: subscription.compExpiresAt,
      })
    ) {
      return this.remember(tenantId, new Set());
    }

    const rows = await this.prisma.tenantModule.findMany({
      where: { tenantId, isActive: true },
      select: { module: true },
    });

    return this.remember(tenantId, new Set(rows.map((row) => row.module)));
  }

  async hasModule(tenantId: string, module: ServiceModule) {
    return (await this.modulesForTenant(tenantId)).has(module);
  }

  async hasAnyModule(tenantId: string, modules: ServiceModule[]) {
    if (!modules.length) return true;
    const granted = await this.modulesForTenant(tenantId);
    return modules.some((module) => granted.has(module));
  }

  /**
   * Filters a permission key list down to what the tenant's purchased modules
   * allow. Used to keep the session payload honest, so the frontend never
   * renders nav for a service the tenant has not bought.
   */
  async filterPermissionKeys(tenantId: string, keys: string[], permissionModuleByKey: Map<string, string>) {
    const granted = await this.modulesForTenant(tenantId);

    return keys.filter((key) => {
      const permissionModule = permissionModuleByKey.get(key);
      if (!permissionModule) return true;
      const service = serviceForPermissionModule(permissionModule);
      return service === null || granted.has(service);
    });
  }

  async summaryForTenant(tenantId: string) {
    const subscription = await this.prisma.tenantSubscription.findUnique({
      where: { tenantId },
    });
    const granted = await this.modulesForTenant(tenantId);

    const comped = subscription
      ? isCompActive({
          source: subscription.source,
          status: subscription.status,
          compExpiresAt: subscription.compExpiresAt,
        })
      : false;

    return {
      status: subscription?.status ?? 'ACTIVE',
      // Whether AI (Gemini) features are available. The frontend hides or
      // disables AI actions when this is false (the Trial plan), and shows an
      // "upgrade to unlock AI" prompt rather than a credit top-up.
      aiEnabled: this.computeAiEnabled(
        subscription
          ? {
              status: subscription.status,
              source: subscription.source,
              compExpiresAt: subscription.compExpiresAt,
              aiEnabled: subscription.aiEnabled,
            }
          : null,
      ),
      // The plan page keys off these to show "Complimentary access" instead of
      // a price and an upgrade button. A comped tenant has no Stripe customer
      // behind them, so prompting them to manage a subscription would dead-end.
      comped,
      compExpiresAt: comped ? (subscription?.compExpiresAt ?? null) : null,
      compReason: comped ? (subscription?.compReason ?? null) : null,
      trialEndsAt: subscription?.trialEndsAt ?? null,
      currentPeriodEnd: subscription?.currentPeriodEnd ?? null,
      cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd ?? false,
      // A complimentary plan the owner has queued behind this tenant's paid
      // one. It changes nothing about what they can do today -- that is what
      // `modules` above is for -- but the plan page says what happens when the
      // paid plan runs out, so "my subscription ended and I still have access"
      // is answered before it is asked.
      //
      // The columns are read straight off the row rather than through
      // PendingCompService: that service depends on provisioning, which
      // depends on this one, and a cycle is not worth a shared getter.
      pendingPlan: this.pendingPlan(subscription),
      modules: SERVICE_MODULES.map((module) => ({
        key: module,
        name: SERVICE_MODULE_LABELS[module],
        active: granted.has(module),
      })),
    };
  }

  /**
   * The queued complimentary plan on a subscription row, named for display.
   *
   * An unrecognised plan key reports nothing rather than guessing: the grant
   * will not be provisioned either (PendingCompService refuses it), so
   * promising the customer a plan that cannot be applied would be worse than
   * saying nothing.
   */
  private pendingPlan(
    subscription: {
      pendingCompPlan: string | null;
      pendingCompStartsAt: Date | null;
      pendingCompDays: number | null;
    } | null,
  ) {
    const key = subscription?.pendingCompPlan;
    if (!key || !isCompPlanKey(key)) return null;

    return {
      key,
      name: COMP_PLAN_LABELS[key],
      // Null means it starts whenever the paid plan ends, on a date not known
      // in advance.
      startsAt: subscription?.pendingCompStartsAt ?? null,
      days: subscription?.pendingCompDays ?? null,
    };
  }

  /** Call after any entitlement write so the next request sees it. */
  invalidate(tenantId: string) {
    this.cache.delete(tenantId);
    this.aiCache.delete(tenantId);
  }

  private remember(tenantId: string, modules: Set<ServiceModule>) {
    this.cache.set(tenantId, { modules, expiresAt: Date.now() + CACHE_TTL_MS });
    return modules;
  }
}
