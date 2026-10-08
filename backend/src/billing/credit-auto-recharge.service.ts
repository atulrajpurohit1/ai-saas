import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  AutoRechargeAttemptStatus,
  AutoRechargePauseReason,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreditsService } from './credits.service';
import { StripeService } from './stripe.service';
import {
  CREDIT_PACKS,
  CREDIT_PACK_KEYS,
  CreditPackKey,
} from './credit-packs.constants';

/**
 * Consecutive declines before auto-recharge pauses itself.
 *
 * One decline is often transient (a temporary hold, a bank's fraud check), so
 * pausing immediately would disable a working card. Three in a row is a card
 * that genuinely is not going to work, and retrying past that is how an
 * account collects a string of failed-payment records.
 */
const MAX_CONSECUTIVE_FAILURES = 3;

/** Minimum gap between automatic charges, as a stop on runaway top-ups. */
const MIN_RECHARGE_INTERVAL_MINUTES = 10;

export interface AutoRechargeSweepOutcome {
  configsChecked: number;
  recharged: number;
  skipped: number;
  failed: number;
}

/**
 * Buys credits automatically when a tenant's balance runs low.
 *
 * Manual top-up already works, and low-balance alerts warn before the balance
 * hits zero, but both need somebody to act. Auto-recharge covers the case
 * nobody is watching -- which also makes it the most dangerous thing in the
 * billing module, because it spends a customer's money with no one present.
 *
 * So every charge is bounded: a tenant-set threshold and pack, an optional
 * monthly cap, a minimum interval between charges, a consecutive-failure
 * limit that pauses rather than retries forever, and an attempt row for every
 * outcome including the ones that charged nothing. Credits are granted
 * through the same idempotent path as an interactive purchase, keyed on the
 * PaymentIntent id, so a replay cannot double-grant.
 */
@Injectable()
export class CreditAutoRechargeService {
  private readonly logger = new Logger(CreditAutoRechargeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly credits: CreditsService,
    private readonly stripe: StripeService,
  ) {}

  /** Current settings for a tenant, or null when never configured. */
  async getConfig(tenantId: string) {
    return this.prisma.creditAutoRecharge.findUnique({ where: { tenantId } });
  }

  /**
   * Creates or updates a tenant's auto-recharge settings.
   *
   * Validates the pack against CREDIT_PACKS rather than trusting the string,
   * and refuses a threshold at or above the pack size: that would re-trigger
   * immediately after every top-up, charging repeatedly up to the cap.
   */
  async upsertConfig(
    tenantId: string,
    input: {
      enabled: boolean;
      thresholdCredits: number;
      packKey: string;
      monthlyCapAmount?: number | null;
    },
  ) {
    const { enabled, thresholdCredits, packKey, monthlyCapAmount } = input;

    if (!CREDIT_PACK_KEYS.includes(packKey as CreditPackKey)) {
      throw new BadRequestException(
        `Unknown credit pack "${packKey}". Expected one of: ${CREDIT_PACK_KEYS.join(
          ', ',
        )}.`,
      );
    }
    if (!Number.isInteger(thresholdCredits) || thresholdCredits <= 0) {
      throw new BadRequestException(
        'The auto-recharge threshold must be a positive whole number of credits.',
      );
    }

    const pack = CREDIT_PACKS[packKey as CreditPackKey];
    if (thresholdCredits >= pack.credits) {
      throw new BadRequestException(
        `A threshold of ${thresholdCredits} is not below the ${pack.credits} credits in the ${pack.label}, so a top-up would immediately re-trigger. Choose a threshold under ${pack.credits}.`,
      );
    }
    if (
      monthlyCapAmount !== null &&
      monthlyCapAmount !== undefined &&
      (!Number.isInteger(monthlyCapAmount) || monthlyCapAmount < pack.price)
    ) {
      throw new BadRequestException(
        `The monthly cap must be a whole number of at least ${pack.price}, the price of one ${pack.label}.`,
      );
    }

    return this.prisma.creditAutoRecharge.upsert({
      where: { tenantId },
      create: {
        tenantId,
        enabled,
        thresholdCredits,
        packKey,
        monthlyCapAmount: monthlyCapAmount ?? null,
      },
      update: {
        enabled,
        thresholdCredits,
        packKey,
        monthlyCapAmount: monthlyCapAmount ?? null,
        // Any deliberate change is a fresh start: a tenant fixing their
        // settings should not stay paused by an earlier decline.
        pausedAt: null,
        pauseReason: null,
        consecutiveFailures: 0,
      },
    });
  }

  /**
   * Records the card a completed Stripe setup session saved.
   *
   * Clears a PAYMENT_FAILED pause: a new card is the tenant's answer to the
   * decline that caused it, so staying paused would ignore the fix. A cap
   * pause is left alone, because a new card does not raise the cap.
   */
  async attachCardFromSetupSession(tenantId: string, sessionId: string) {
    const saved = await this.stripe.paymentMethodFromSetupSession(sessionId);
    if (!saved) {
      throw new BadRequestException(
        'That card setup was not completed, so no card was saved.',
      );
    }

    const existing = await this.prisma.creditAutoRecharge.findUnique({
      where: { tenantId },
      select: { id: true, pauseReason: true },
    });
    if (!existing) {
      throw new NotFoundException(
        'Configure auto-recharge before saving a card for it.',
      );
    }

    const clearPause =
      existing.pauseReason === AutoRechargePauseReason.PAYMENT_FAILED;

    return this.prisma.creditAutoRecharge.update({
      where: { tenantId },
      data: {
        stripePaymentMethodId: saved.paymentMethodId,
        cardBrand: saved.brand,
        cardLast4: saved.last4,
        ...(clearPause
          ? { pausedAt: null, pauseReason: null, consecutiveFailures: 0 }
          : {}),
      },
    });
  }

  /**
   * Automatic spend so far this calendar month, in whole currency units.
   *
   * Counts successful attempts only: a decline costs the tenant nothing and
   * must not consume their cap, or a few failures would lock out a working
   * card for the rest of the month.
   */
  async monthlySpend(configId: string, now = new Date()): Promise<number> {
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const result = await this.prisma.creditAutoRechargeAttempt.aggregate({
      where: {
        configId,
        status: AutoRechargeAttemptStatus.SUCCEEDED,
        createdAt: { gte: monthStart },
      },
      _sum: { amountCharged: true },
    });
    return result._sum.amountCharged ?? 0;
  }

  /**
   * Checks every armed config and tops up the ones that are due.
   *
   * Never throws: one tenant's declined card must not stop others from being
   * topped up.
   */
  async sweep(): Promise<AutoRechargeSweepOutcome> {
    const outcome: AutoRechargeSweepOutcome = {
      configsChecked: 0,
      recharged: 0,
      skipped: 0,
      failed: 0,
    };

    const configs = await this.prisma.creditAutoRecharge.findMany({
      where: { enabled: true, pausedAt: null },
      select: { tenantId: true },
    });

    for (const config of configs) {
      outcome.configsChecked += 1;
      try {
        const result = await this.rechargeIfDue(config.tenantId);
        if (result.status === 'recharged') outcome.recharged += 1;
        else if (result.status === 'failed') outcome.failed += 1;
        else outcome.skipped += 1;
      } catch (error) {
        outcome.failed += 1;
        this.logger.error(
          `Auto-recharge failed for tenant ${config.tenantId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    return outcome;
  }

  /**
   * Tops one tenant up if every guard allows it.
   *
   * Each guard returns a reason rather than throwing, so the attempt row says
   * exactly why nothing was charged.
   */
  async rechargeIfDue(tenantId: string): Promise<{
    status: 'recharged' | 'skipped' | 'failed';
    reason?: string;
    creditsGranted?: number;
  }> {
    const config = await this.prisma.creditAutoRecharge.findUnique({
      where: { tenantId },
    });
    if (!config) return { status: 'skipped', reason: 'not-configured' };
    if (!config.enabled) return { status: 'skipped', reason: 'disabled' };
    if (config.pausedAt) return { status: 'skipped', reason: 'paused' };

    const pack = CREDIT_PACKS[config.packKey as CreditPackKey];
    if (!pack) {
      // The pack was renamed or removed after this config was saved. Pausing
      // is right: silently substituting a different pack would charge an
      // amount the tenant never agreed to.
      await this.pause(tenantId, AutoRechargePauseReason.PAYMENT_FAILED);
      return { status: 'skipped', reason: 'unknown-pack' };
    }

    const { balance } = await this.credits.getBalance(tenantId);
    if (balance > config.thresholdCredits) {
      return { status: 'skipped', reason: 'above-threshold' };
    }

    if (!config.stripePaymentMethodId) {
      await this.recordAttempt(config, balance, {
        status: AutoRechargeAttemptStatus.SKIPPED,
        failureReason: 'No saved card.',
      });
      return { status: 'skipped', reason: 'no-card' };
    }

    // Guards against a burst of top-ups if the balance reads low repeatedly
    // before a grant lands.
    if (config.lastRechargeAt) {
      const minutesSince =
        (Date.now() - config.lastRechargeAt.getTime()) / 60_000;
      if (minutesSince < MIN_RECHARGE_INTERVAL_MINUTES) {
        return { status: 'skipped', reason: 'too-soon' };
      }
    }

    if (config.monthlyCapAmount !== null) {
      const spent = await this.monthlySpend(config.id);
      if (spent + pack.price > config.monthlyCapAmount) {
        await this.recordAttempt(config, balance, {
          status: AutoRechargeAttemptStatus.SKIPPED,
          failureReason: `Monthly cap reached: ${spent} of ${config.monthlyCapAmount} already spent this month.`,
        });
        await this.pause(tenantId, AutoRechargePauseReason.MONTHLY_CAP_REACHED);
        this.logger.warn(
          `Auto-recharge paused for tenant ${tenantId}: monthly cap of ${config.monthlyCapAmount} reached.`,
        );
        return { status: 'skipped', reason: 'monthly-cap' };
      }
    }

    return this.charge(config, pack, balance);
  }

  /**
   * Charges the card and grants the credits.
   *
   * The grant is keyed on the PaymentIntent id, which is unique, so it is
   * idempotent: if this runs twice for one charge -- a retry, a concurrent
   * sweep -- the second grant is a no-op rather than free credits.
   */
  private async charge(
    config: {
      id: string;
      tenantId: string;
      packKey: string;
      consecutiveFailures: number;
      stripePaymentMethodId: string | null;
    },
    pack: { key: CreditPackKey; label: string; credits: number; price: number },
    balance: number,
  ): Promise<{
    status: 'recharged' | 'failed';
    reason?: string;
    creditsGranted?: number;
  }> {
    const paymentMethodId = config.stripePaymentMethodId;
    if (!paymentMethodId) {
      return { status: 'failed', reason: 'no-card' };
    }

    let charge: Awaited<ReturnType<StripeService['chargeSavedCardForPack']>>;
    try {
      charge = await this.stripe.chargeSavedCardForPack({
        tenantId: config.tenantId,
        pack: pack.key,
        paymentMethodId,
      });
    } catch (error) {
      const reason =
        error instanceof Error ? error.message : 'Card charge failed.';
      await this.onChargeFailed(config, balance, reason);
      return { status: 'failed', reason };
    }

    if (charge.status !== 'succeeded') {
      // requires_action means the bank wants a challenge nobody is present to
      // complete -- unusable for auto-recharge, so treat it as a failure
      // rather than leaving a pending intent behind.
      const reason = `Stripe returned status "${charge.status}" for an off-session charge.`;
      await this.onChargeFailed(config, balance, reason);
      return { status: 'failed', reason };
    }

    const granted = await this.credits.grant({
      tenantId: config.tenantId,
      amount: pack.credits,
      description: `Auto-recharge, ${pack.label}: ${pack.credits} Prospect Search credits.`,
      stripeSessionId: charge.paymentIntentId,
    });

    await this.prisma.$transaction([
      this.prisma.creditAutoRechargeAttempt.create({
        data: {
          configId: config.id,
          tenantId: config.tenantId,
          status: AutoRechargeAttemptStatus.SUCCEEDED,
          balanceAtTrigger: balance,
          packKey: pack.key,
          amountCharged: pack.price,
          creditsGranted: granted.granted ? pack.credits : 0,
          stripePaymentIntentId: charge.paymentIntentId,
        },
      }),
      this.prisma.creditAutoRecharge.update({
        where: { id: config.id },
        data: { lastRechargeAt: new Date(), consecutiveFailures: 0 },
      }),
    ]);

    this.logger.log(
      `Auto-recharged tenant ${config.tenantId}: ${pack.credits} credits for ${pack.price} (balance was ${balance}, now ${granted.balance}).`,
    );

    return { status: 'recharged', creditsGranted: pack.credits };
  }

  /**
   * Records a decline and pauses once the failure limit is hit.
   *
   * Pausing leaves `enabled` true: the tenant configured this, and flipping
   * it off would hide why it stopped. `pauseReason` is what their billing
   * page shows them.
   */
  private async onChargeFailed(
    config: {
      id: string;
      tenantId: string;
      packKey: string;
      consecutiveFailures: number;
    },
    balance: number,
    reason: string,
  ) {
    const failures = config.consecutiveFailures + 1;

    await this.prisma.creditAutoRechargeAttempt.create({
      data: {
        configId: config.id,
        tenantId: config.tenantId,
        status: AutoRechargeAttemptStatus.FAILED,
        balanceAtTrigger: balance,
        packKey: config.packKey,
        failureReason: reason.slice(0, 500),
      },
    });

    const shouldPause = failures >= MAX_CONSECUTIVE_FAILURES;
    await this.prisma.creditAutoRecharge.update({
      where: { id: config.id },
      data: {
        consecutiveFailures: failures,
        ...(shouldPause
          ? {
              pausedAt: new Date(),
              pauseReason: AutoRechargePauseReason.PAYMENT_FAILED,
            }
          : {}),
      },
    });

    if (shouldPause) {
      this.logger.error(
        `Auto-recharge paused for tenant ${config.tenantId} after ${failures} consecutive card failures. Last reason: ${reason}`,
      );
    } else {
      this.logger.warn(
        `Auto-recharge attempt ${failures}/${MAX_CONSECUTIVE_FAILURES} failed for tenant ${config.tenantId}: ${reason}`,
      );
    }
  }

  private async pause(tenantId: string, reason: AutoRechargePauseReason) {
    await this.prisma.creditAutoRecharge.update({
      where: { tenantId },
      data: { pausedAt: new Date(), pauseReason: reason },
    });
  }

  /** Clears a pause so automatic charging can resume. */
  async resume(tenantId: string) {
    return this.prisma.creditAutoRecharge.update({
      where: { tenantId },
      data: { pausedAt: null, pauseReason: null, consecutiveFailures: 0 },
    });
  }

  private async recordAttempt(
    config: { id: string; tenantId: string; packKey: string },
    balance: number,
    params: {
      status: AutoRechargeAttemptStatus;
      failureReason?: string;
    },
  ) {
    await this.prisma.creditAutoRechargeAttempt.create({
      data: {
        configId: config.id,
        tenantId: config.tenantId,
        status: params.status,
        balanceAtTrigger: balance,
        packKey: config.packKey,
        failureReason: params.failureReason?.slice(0, 500),
      },
    });
  }

  /** Recent attempts, for the tenant's billing page and for support. */
  async recentAttempts(tenantId: string, limit = 20) {
    return this.prisma.creditAutoRechargeAttempt.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 100),
    });
  }
}
