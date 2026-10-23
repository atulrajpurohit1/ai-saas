import { Injectable, Logger } from '@nestjs/common';
import {
  ServiceModule,
  SubscriptionSource,
  SubscriptionStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { AuditService } from '../audit/audit.service';
import { isCompActive } from './comp.util';

export interface ProvisionInput {
  tenantId: string;
  modules: ServiceModule[];
  status: SubscriptionStatus;
  trialEndsAt?: Date | null;
  currentPeriodEnd?: Date | null;
  cancelAtPeriodEnd?: boolean;
  providerCustomerId?: string | null;
  providerSubscriptionId?: string | null;
  /**
   * Defaults to STRIPE. Pass COMP for access granted by the platform owner
   * with no payment behind it; the Stripe webhook then leaves the tenant
   * alone rather than resetting it on the next event.
   */
  source?: SubscriptionSource;
  /**
   * Whether this tenant may use AI (Gemini) features. Defaults to true, so a
   * Stripe provisioning and a comp of a real plan both leave AI on. Only the
   * Trial plan passes false. Set on every provisioning, so converting a Trial
   * tenant to a paid plan turns AI back on by the same path.
   */
  aiEnabled?: boolean;
  /** Only meaningful with source COMP. Null means the comp does not lapse. */
  compExpiresAt?: Date | null;
  /**
   * Which plan the comp granted, as a comp plan key. Only meaningful with
   * source COMP; a STRIPE provisioning clears it along with the other comp
   * fields.
   *
   * Passed in rather than worked out from `modules` here, because the modules
   * cannot express it: Trial and Complete grant the same three, and only the
   * caller knows which one was chosen.
   */
  compPlan?: string | null;
  compReason?: string | null;
  compGrantedBy?: string | null;
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
      source = 'STRIPE',
      aiEnabled = true,
      compExpiresAt = null,
      compPlan = null,
      compReason = null,
      compGrantedBy = null,
      reason,
    } = input;

    // Comp fields are only written on a COMP provisioning. A STRIPE one
    // clears them, which is what converting a comped tenant onto a real
    // subscription should do -- otherwise a stale expiry would sit there
    // waiting to revoke a paying customer.
    const compFields =
      source === 'COMP'
        ? { compExpiresAt, compPlan, compReason, compGrantedBy }
        : {
            compExpiresAt: null,
            compPlan: null,
            compReason: null,
            compGrantedBy: null,
          };

    const desired = new Set(modules);

    await this.prisma.$transaction(async (tx) => {
      await tx.tenantSubscription.upsert({
        where: { tenantId },
        create: {
          tenantId,
          status,
          source,
          aiEnabled,
          trialEndsAt,
          currentPeriodEnd,
          cancelAtPeriodEnd,
          providerCustomerId,
          providerSubscriptionId,
          ...compFields,
        },
        update: {
          status,
          source,
          aiEnabled,
          trialEndsAt,
          currentPeriodEnd,
          cancelAtPeriodEnd,
          ...compFields,
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
          source,
          ...(source === 'COMP'
            ? {
                compExpiresAt: compExpiresAt?.toISOString() ?? null,
                compPlan,
                compReason,
                compGrantedBy,
              }
            : {}),
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

  /**
   * Is this tenant running on live complimentary access?
   *
   * The Stripe webhook calls this before writing anything, so a stray event
   * cannot reset a comp. It returns false for a lapsed or revoked comp on
   * purpose: a tenant who was comped and later decides to pay must be able to
   * have Stripe provision them normally.
   */
  async isComped(tenantId: string): Promise<boolean> {
    const subscription = await this.prisma.tenantSubscription.findUnique({
      where: { tenantId },
      select: { source: true, status: true, compExpiresAt: true },
    });

    return subscription ? isCompActive(subscription) : false;
  }

  /**
   * Ends complimentary access.
   *
   * Modelled as a provisioning with no modules rather than a status flip, so
   * it runs through the same converging path as every other entitlement
   * change. The row stays COMP with its reason intact: the history of who was
   * given free access, and why, is worth more than a tidy table.
   */
  async revokeComp(tenantId: string, revokedBy: string, reason?: string) {
    // Carried over deliberately: a revoked comp keeps the name of the plan it
    // granted, for the same reason it keeps its reason. "What did we give this
    // tenant, and why" is the question the comp list exists to answer, and
    // revoking is when it starts being asked.
    const existing = await this.prisma.tenantSubscription.findUnique({
      where: { tenantId },
      select: { compPlan: true },
    });

    return this.provision({
      tenantId,
      modules: [],
      status: 'CANCELED',
      source: 'COMP',
      compExpiresAt: new Date(),
      compPlan: existing?.compPlan ?? null,
      compReason: reason ?? null,
      compGrantedBy: revokedBy,
      reason: `comp-revoked:${revokedBy}`,
    });
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
