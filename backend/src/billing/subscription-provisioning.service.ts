import { Injectable, Logger } from '@nestjs/common';
import { ServiceModule, SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { AuditService } from '../audit/audit.service';

export interface ProvisionInput {
  tenantId: string;
  modules: ServiceModule[];
  status: SubscriptionStatus;
  trialEndsAt?: Date | null;
  currentPeriodEnd?: Date | null;
  cancelAtPeriodEnd?: boolean;
  providerCustomerId?: string | null;
  providerSubscriptionId?: string | null;
  /** Free-text note for the audit trail, e.g. the Stripe event id. */
  reason?: string;
}

/**
 * Turns "this tenant has paid for these services" into entitlement rows.
 *
 * Deliberately knows nothing about Stripe. The webhook translates provider
 * events into a ProvisionInput and calls this; an admin provisioning a
 * customer by hand calls exactly the same path. That matters right now,
 * because manual provisioning is how the first standalone customers will be
 * onboarded while checkout is still being built -- and it means the manual
 * route is exercised by the same code that payments will use, not a shortcut
 * that rots.
 */
@Injectable()
export class SubscriptionProvisioningService {
  private readonly logger = new Logger(SubscriptionProvisioningService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlements: EntitlementsService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Sets a tenant's services to exactly `modules`: anything not listed is
   * deactivated, anything listed is (re)activated.
   *
   * Rows are deactivated rather than deleted so a customer who cancels and
   * returns keeps their history, and so reactivating is a flag flip.
   *
   * Idempotent: replaying the same event produces the same end state, which
   * matters because Stripe retries webhooks and delivers out of order.
   */
  async provision(input: ProvisionInput) {
    const {
      tenantId,
      modules,
      status,
      trialEndsAt = null,
      currentPeriodEnd = null,
      cancelAtPeriodEnd = false,
      providerCustomerId = null,
      providerSubscriptionId = null,
      reason,
    } = input;

    const desired = new Set(modules);

    await this.prisma.$transaction(async (tx) => {
      await tx.tenantSubscription.upsert({
        where: { tenantId },
        create: {
          tenantId,
          status,
          trialEndsAt,
          currentPeriodEnd,
          cancelAtPeriodEnd,
          providerCustomerId,
          providerSubscriptionId,
        },
        update: {
          status,
          trialEndsAt,
          currentPeriodEnd,
          cancelAtPeriodEnd,
          // Never null out an existing provider id with a missing one: a
          // partial event must not orphan the tenant from its Stripe customer.
          ...(providerCustomerId ? { providerCustomerId } : {}),
          ...(providerSubscriptionId ? { providerSubscriptionId } : {}),
        },
      });

      const existing = await tx.tenantModule.findMany({ where: { tenantId } });
      const seen = new Set(existing.map((row) => row.module));

      for (const row of existing) {
        const shouldBeActive = desired.has(row.module);
        if (row.isActive !== shouldBeActive) {
          await tx.tenantModule.update({
            where: { id: row.id },
            data: { isActive: shouldBeActive },
          });
        }
      }

      const toCreate = [...desired].filter((module) => !seen.has(module));
      if (toCreate.length) {
        await tx.tenantModule.createMany({
          data: toCreate.map((module) => ({ tenantId, module, isActive: true })),
        });
      }
    });

    // The service caches per tenant; without this the customer would wait up
    // to 30s after paying before their new services appeared.
    this.entitlements.invalidate(tenantId);

    await this.audit
      .log({
        tenantId,
        action: 'subscription.provisioned',
        entityType: 'TenantSubscription',
        entityId: providerSubscriptionId ?? tenantId,
        details: JSON.stringify({
          modules: [...desired].sort(),
          status,
          reason: reason ?? 'manual',
        }),
      })
      .catch((error: Error) => {
        // An audit write must never fail a paid provisioning.
        this.logger.warn(`Audit log failed for ${tenantId}: ${error.message}`);
      });

    this.logger.log(
      `Provisioned ${tenantId}: [${[...desired].sort().join(', ') || 'none'}] status=${status}${
        reason ? ` (${reason})` : ''
      }`,
    );

    return this.entitlements.summaryForTenant(tenantId);
  }

  /** Marks a subscription cancelled, leaving module rows intact for history. */
  async cancel(tenantId: string, reason?: string) {
    await this.prisma.tenantSubscription.updateMany({
      where: { tenantId },
      data: { status: 'CANCELED', cancelAtPeriodEnd: false },
    });
    this.entitlements.invalidate(tenantId);

    await this.audit
      .log({
        tenantId,
        action: 'subscription.canceled',
        entityType: 'TenantSubscription',
        entityId: tenantId,
        details: JSON.stringify({ reason: reason ?? 'manual' }),
      })
      .catch(() => undefined);

    this.logger.log(`Cancelled subscription for ${tenantId}${reason ? ` (${reason})` : ''}`);
  }

  async setStatus(
    tenantId: string,
    status: SubscriptionStatus,
    reason?: string,
  ) {
    await this.prisma.tenantSubscription.updateMany({
      where: { tenantId },
      data: { status },
    });
    this.entitlements.invalidate(tenantId);
    this.logger.log(
      `Status for ${tenantId} -> ${status}${reason ? ` (${reason})` : ''}`,
    );
  }

  /** Resolves the tenant a Stripe customer/subscription belongs to. */
  async tenantForProviderIds(ids: {
    customerId?: string | null;
    subscriptionId?: string | null;
  }): Promise<string | null> {
    const { customerId, subscriptionId } = ids;
    if (!customerId && !subscriptionId) return null;

    const match = await this.prisma.tenantSubscription.findFirst({
      where: {
        OR: [
          ...(subscriptionId ? [{ providerSubscriptionId: subscriptionId }] : []),
          ...(customerId ? [{ providerCustomerId: customerId }] : []),
        ],
      },
      select: { tenantId: true },
    });

    return match?.tenantId ?? null;
  }
}
