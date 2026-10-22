import { Injectable, Logger } from '@nestjs/common';
import { SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  COMP_PLAN_LABELS,
  COMP_PLAN_MODULES,
  CompPlanKey,
  compPlanAiEnabled,
  isCompPlanKey,
} from './comp-plan.constants';
import { SubscriptionProvisioningService } from './subscription-provisioning.service';

/** Statuses a paid subscription can hold and still be worth protecting. */
const LIVE_STATUSES: SubscriptionStatus[] = ['ACTIVE', 'TRIALING', 'PAST_DUE'];

/** The columns that make up a parked grant, cleared together. */
const CLEARED = {
  pendingCompPlan: null,
  pendingCompStartsAt: null,
  pendingCompDays: null,
  pendingCompReason: null,
  pendingCompGrantedBy: null,
};

export interface PendingComp {
  plan: CompPlanKey;
  startsAt: Date | null;
  days: number | null;
  reason: string | null;
  grantedBy: string | null;
}

/**
 * Complimentary plans queued behind a paid subscription.
 *
 * A comp granted to a tenant with nothing to protect applies at once -- that
 * is still CompController's job, and this service never sees it. This exists
 * for the other case: the tenant is inside a paid period they have already
 * been charged for, so the free plan has to wait for that period to end rather
 * than downgrade them in the middle of it.
 *
 * Two things can make a parked grant due, and both converge on `activate`:
 *  - Stripe reports the subscription gone (the reliable signal, and the only
 *    one that knows about an early cancellation).
 *  - The recorded start date passes, swept hourly (the backstop for when no
 *    event arrives, or when there was never a Stripe subscription to send one).
 *
 * A grant that stays parked is the safe failure: the tenant keeps the paid
 * access they are paying for. That is the opposite of a lapsing comp, which is
 * why this uses a sweep where `isCompActive` deliberately does not.
 */
@Injectable()
export class PendingCompService {
  private readonly logger = new Logger(PendingCompService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly provisioning: SubscriptionProvisioningService,
    private readonly audit: AuditService,
  ) {}

  /**
   * The paid plan a comp would have to wait for, or null if there is nothing
   * to wait for and the comp should apply now.
   *
   * Only a STRIPE-sourced subscription counts. A tenant already on a comp has
   * no payment to protect, so re-comping them onto another plan takes effect
   * immediately -- including swapping a comped paid plan for the Trial plan.
   */
  async livePaidPlan(tenantId: string): Promise<{ endsAt: Date | null } | null> {
    const subscription = await this.prisma.tenantSubscription.findUnique({
      where: { tenantId },
      select: {
        source: true,
        status: true,
        currentPeriodEnd: true,
        providerSubscriptionId: true,
      },
    });

    if (!subscription) return null;
    if (subscription.source !== 'STRIPE') return null;
    if (!LIVE_STATUSES.includes(subscription.status)) return null;

    // A subscription with no provider id was provisioned by hand and has no
    // billing behind it, so there is no charge to see out.
    if (!subscription.providerSubscriptionId) return null;

    const endsAt = subscription.currentPeriodEnd;

    // A period that has already elapsed is not something to wait for: Stripe
    // either renewed it (and the event has not landed yet) or cancelled it. In
    // the first case waiting on a stale date would apply the comp immediately
    // anyway, so treat it as nothing to protect and let the grant apply now.
    if (endsAt && endsAt <= new Date()) return null;

    // endsAt may still be null here: a live subscription whose period end was
    // never recorded. Park the comp with no date and let the Stripe
    // cancellation event release it.
    return { endsAt };
  }

  /** Reads back a parked grant, or null. Unknown plan keys are discarded. */
  async get(tenantId: string): Promise<PendingComp | null> {
    const row = await this.prisma.tenantSubscription.findUnique({
      where: { tenantId },
      select: {
        pendingCompPlan: true,
        pendingCompStartsAt: true,
        pendingCompDays: true,
        pendingCompReason: true,
        pendingCompGrantedBy: true,
      },
    });

    return this.fromRow(tenantId, row);
  }

  /**
   * Parks a grant to be applied when the paid plan ends. Replaces any grant
   * already parked: the last thing the owner chose is what should happen.
   */
  async schedule(input: {
    tenantId: string;
    plan: CompPlanKey;
    startsAt: Date | null;
    days: number | null;
    reason: string;
    grantedBy: string;
  }): Promise<PendingComp> {
    await this.prisma.tenantSubscription.update({
      where: { tenantId: input.tenantId },
      data: {
        pendingCompPlan: input.plan,
        pendingCompStartsAt: input.startsAt,
        pendingCompDays: input.days,
        pendingCompReason: input.reason,
        pendingCompGrantedBy: input.grantedBy,
      },
    });

    await this.audit
      .log({
        tenantId: input.tenantId,
        action: 'subscription.comp_scheduled',
        entityType: 'TenantSubscription',
        entityId: input.tenantId,
        details: JSON.stringify({
          plan: input.plan,
          startsAt: input.startsAt?.toISOString() ?? null,
          days: input.days,
          reason: input.reason,
          grantedBy: input.grantedBy,
        }),
      })
      .catch(() => undefined);

    this.logger.log(
      `Queued ${COMP_PLAN_LABELS[input.plan]} for ${input.tenantId}, starting ` +
        `${input.startsAt?.toISOString() ?? 'when the paid plan ends'}.`,
    );

    return {
      plan: input.plan,
      startsAt: input.startsAt,
      days: input.days,
      reason: input.reason,
      grantedBy: input.grantedBy,
    };
  }

  /** Drops a parked grant. Used when the owner revokes before it starts. */
  async cancel(tenantId: string): Promise<boolean> {
    const pending = await this.get(tenantId);
    if (!pending) return false;

    await this.prisma.tenantSubscription.update({
      where: { tenantId },
      data: CLEARED,
    });

    await this.audit
      .log({
        tenantId,
        action: 'subscription.comp_schedule_cancelled',
        entityType: 'TenantSubscription',
        entityId: tenantId,
        details: JSON.stringify({ plan: pending.plan }),
      })
      .catch(() => undefined);

    this.logger.log(`Cancelled the queued comp for ${tenantId}.`);
    return true;
  }

  /**
   * Applies a tenant's parked grant now, if they have one.
   *
   * Called by the Stripe webhook the moment a subscription ends, so the free
   * plan takes over with no gap, and by the sweep for everything else.
   *
   * The parked columns are cleared AFTER provisioning succeeds, not before:
   * clearing first would lose the grant outright if provisioning then failed.
   * A redelivered event finds the columns empty and does nothing, which is what
   * makes this safe to call from a webhook Stripe may retry.
   */
  async activate(tenantId: string, trigger: string) {
    const pending = await this.get(tenantId);
    if (!pending) return null;

    const expiresAt = pending.days
      ? new Date(Date.now() + pending.days * 24 * 60 * 60 * 1000)
      : null;

    const summary = await this.provisioning.provision({
      tenantId,
      modules: COMP_PLAN_MODULES[pending.plan],
      status: 'ACTIVE',
      source: 'COMP',
      aiEnabled: compPlanAiEnabled(pending.plan),
      compExpiresAt: expiresAt,
      compReason: pending.reason,
      compGrantedBy: pending.grantedBy,
      reason: `comp-activated:${trigger}`,
    });

    await this.prisma.tenantSubscription.update({
      where: { tenantId },
      data: CLEARED,
    });

    this.logger.log(
      `Activated ${COMP_PLAN_LABELS[pending.plan]} for ${tenantId} ` +
        `(${trigger}); runs until ${expiresAt?.toISOString() ?? 'further notice'}.`,
    );

    return { plan: pending.plan, expiresAt, summary };
  }

  /**
   * Applies every parked grant whose start date has passed.
   *
   * Grants parked with no start date are skipped deliberately: there is no date
   * to compare, and the Stripe cancellation event is what releases them. A
   * failure on one tenant must not abandon the rest, so each is caught.
   */
  async activateDue() {
    const due = await this.prisma.tenantSubscription.findMany({
      where: {
        pendingCompPlan: { not: null },
        pendingCompStartsAt: { not: null, lte: new Date() },
      },
      select: { tenantId: true },
    });

    let activated = 0;
    let failures = 0;

    for (const row of due) {
      try {
        if (await this.activate(row.tenantId, 'sweep')) activated += 1;
      } catch (error) {
        failures += 1;
        this.logger.error(
          `Could not activate the queued comp for ${row.tenantId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    return { due: due.length, activated, failures };
  }

  private fromRow(
    tenantId: string,
    row: {
      pendingCompPlan: string | null;
      pendingCompStartsAt: Date | null;
      pendingCompDays: number | null;
      pendingCompReason: string | null;
      pendingCompGrantedBy: string | null;
    } | null,
  ): PendingComp | null {
    if (!row?.pendingCompPlan) return null;

    // A plan key that no longer exists must not be provisioned as an empty
    // module list, which would lock the tenant out. Refuse it loudly and leave
    // the row alone for a human to sort out.
    if (!isCompPlanKey(row.pendingCompPlan)) {
      this.logger.error(
        `Tenant ${tenantId} has a queued comp for unknown plan ` +
          `"${row.pendingCompPlan}"; ignoring it. Re-grant the comp.`,
      );
      return null;
    }

    return {
      plan: row.pendingCompPlan,
      startsAt: row.pendingCompStartsAt,
      days: row.pendingCompDays,
      reason: row.pendingCompReason,
      grantedBy: row.pendingCompGrantedBy,
    };
  }
}
