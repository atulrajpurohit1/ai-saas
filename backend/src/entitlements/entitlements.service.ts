import { Injectable, Logger } from '@nestjs/common';
import { ServiceModule, SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  SERVICE_MODULES,
  SERVICE_MODULE_LABELS,
  serviceForPermissionModule,
} from './entitlements.constants';

/** Statuses that still grant access. PAST_DUE keeps working -- dunning is a
 *  billing conversation, not a reason to strand a paying customer mid-shift. */
const ACTIVE_STATUSES: SubscriptionStatus[] = ['ACTIVE', 'TRIALING', 'PAST_DUE'];

const CACHE_TTL_MS = 30_000;

type CacheEntry = { modules: Set<ServiceModule>; expiresAt: number };

@Injectable()
export class EntitlementsService {
  private readonly logger = new Logger(EntitlementsService.name);
  private readonly cache = new Map<string, CacheEntry>();

  constructor(private readonly prisma: PrismaService) {}

  async modulesForTenant(tenantId: string): Promise<Set<ServiceModule>> {
    if (!tenantId) return new Set();

    const cached = this.cache.get(tenantId);
    if (cached && cached.expiresAt > Date.now()) return cached.modules;

    const subscription = await this.prisma.tenantSubscription.findUnique({
      where: { tenantId },
      select: { status: true },
    });

    // No subscription row at all: a tenant created before this system existed
    // and somehow missed the backfill. Fail OPEN rather than locking a paying
    // customer out of a product they already use.
    if (!subscription) {
      this.logger.warn(
        `Tenant ${tenantId} has no subscription row; granting all modules.`,
      );
      return this.remember(tenantId, new Set(SERVICE_MODULES));
    }

    if (!ACTIVE_STATUSES.includes(subscription.status)) {
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

    return {
      status: subscription?.status ?? 'ACTIVE',
      trialEndsAt: subscription?.trialEndsAt ?? null,
      currentPeriodEnd: subscription?.currentPeriodEnd ?? null,
      cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd ?? false,
      modules: SERVICE_MODULES.map((module) => ({
        key: module,
        name: SERVICE_MODULE_LABELS[module],
        active: granted.has(module),
      })),
    };
  }

  /** Call after any entitlement write so the next request sees it. */
  invalidate(tenantId: string) {
    this.cache.delete(tenantId);
  }

  private remember(tenantId: string, modules: Set<ServiceModule>) {
    this.cache.set(tenantId, { modules, expiresAt: Date.now() + CACHE_TTL_MS });
    return modules;
  }
}
