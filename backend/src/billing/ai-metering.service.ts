import { Injectable, Logger } from '@nestjs/common';
import { AiFeature } from '@prisma/client';
import { CreditsService } from './credits.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { aiCreditCost } from './ai-credit-costs.constants';
import { AiNotOnPlanException } from './ai-not-on-plan.exception';

/** What a metered AI call needs to know about who is paying. */
export interface AiMeterContext {
  tenantId: string;
  userId?: string;
  feature: AiFeature;
}

/**
 * Charges credits for AI feature use.
 *
 * AI features were unmetered: the permission guard answered whether a plan
 * included a feature, never how much of it had been used. The product is sold
 * on limits -- a customer reaches them and buys more -- so unlimited AI
 * contradicted the pricing it ships under.
 *
 * ## Why this does not use reserve-then-settle
 *
 * Prospect Search holds credits up front because a BlackPearl job is
 * asynchronous and its true cost arrives minutes later. An AI call is
 * synchronous and its price is fixed by feature, so there is nothing to
 * settle: the cost is known before the call and the outcome when it returns.
 * CreditsService.spend() charges in one transaction instead, and a failure
 * refunds -- one fewer state to leak than a hold that always resolves the
 * same way.
 *
 * ## Why it charges before the call
 *
 * Charging afterwards would let a tenant at zero credits run work we have
 * already paid Google for. Charging first refuses them before we spend
 * anything, and a failed call is refunded -- so a customer is never billed
 * for output they did not receive.
 */
@Injectable()
export class AiMeteringService {
  private readonly logger = new Logger(AiMeteringService.name);

  constructor(
    private readonly credits: CreditsService,
    private readonly entitlements: EntitlementsService,
  ) {}

  /** Credit price of one call, after any env override. */
  costOf(feature: AiFeature): number {
    return aiCreditCost(feature);
  }

  /**
   * Whether the tenant's plan includes AI, without charging or running
   * anything.
   *
   * For a Gemini enrichment that rides on top of a non-AI workflow -- the
   * one-line explanation of a rule-based guard recommendation, say -- where
   * the surrounding feature (assigning a guard to a shift) must never cost
   * credits. Such a caller runs the AI free when the plan allows it and falls
   * back to its rule-based text when it does not, so it only needs the plan
   * gate, not the meter.
   */
  async isAiEnabled(tenantId: string): Promise<boolean> {
    return this.entitlements.isAiEnabled(tenantId);
  }

  /**
   * Refuses the call outright when the tenant's plan excludes AI (the Trial
   * plan). Checked before cost and before any credit spend, so a free (cost 0)
   * feature is blocked too, and a Trial tenant with credits bought for prospect
   * search cannot spend them on AI. Raises a 403 AI_NOT_ON_PLAN, distinct from
   * the 402 a credit shortfall raises.
   *
   * This is one of exactly two enforcement points for the AI switch; the other
   * is the prospect company-insight endpoint, the only AI call that does not
   * pass through here.
   */
  private async assertAiEnabled(tenantId: string): Promise<void> {
    if (!(await this.entitlements.isAiEnabled(tenantId))) {
      throw new AiNotOnPlanException();
    }
  }

  /**
   * Whether the tenant could afford this feature right now.
   *
   * For greying out a feature before the user clicks it. Never use it as the
   * gate: between this check and the call another request could spend the
   * balance. `run` is the gate.
   */
  async canAfford(tenantId: string, feature: AiFeature): Promise<boolean> {
    const cost = this.costOf(feature);
    if (cost === 0) return true;
    return this.credits.hasCredits(tenantId, cost);
  }

  /**
   * Runs a metered AI call: charge, execute, refund on failure.
   *
   * Throws 402 INSUFFICIENT_CREDITS before `work` runs when the tenant cannot
   * pay -- the same exception Prospect Search raises, so the frontend already
   * tells "out of credits" apart from "you do not have this feature".
   *
   * A free feature (cost 0) skips the ledger rather than writing rows that say
   * nothing.
   */
  async run<T>(context: AiMeterContext, work: () => Promise<T>): Promise<T> {
    const { tenantId, userId, feature } = context;
    await this.assertAiEnabled(tenantId);
    const cost = this.costOf(feature);

    if (cost === 0) return work();

    await this.credits.spend({
      tenantId,
      userId,
      amount: cost,
      description: this.chargeDescription(feature, cost),
    });

    try {
      return await work();
    } catch (error) {
      await this.refund(tenantId, userId, feature, cost, error);
      throw error;
    }
  }

  /**
   * Runs a metered call, refunding when the result turns out not to be
   * chargeable.
   *
   * Some AI methods succeed without doing AI work: when Gemini is
   * unconfigured or failing and ENABLE_AI_FALLBACK is on, they return a
   * locally-built structured fallback and flag it (`fallbackUsed: true`).
   * That is not the feature the customer paid for, so `chargeable` lets the
   * caller say so and get the credits back.
   */
  async runChargeableIf<T>(
    context: AiMeterContext,
    work: () => Promise<T>,
    chargeable: (result: T) => boolean,
  ): Promise<T> {
    const { tenantId, userId, feature } = context;
    await this.assertAiEnabled(tenantId);
    const cost = this.costOf(feature);

    if (cost === 0) return work();

    await this.credits.spend({
      tenantId,
      userId,
      amount: cost,
      description: this.chargeDescription(feature, cost),
    });

    let result: T;
    try {
      result = await work();
    } catch (error) {
      await this.refund(tenantId, userId, feature, cost, error);
      throw error;
    }

    if (!chargeable(result)) {
      await this.refund(
        tenantId,
        userId,
        feature,
        cost,
        new Error('the feature fell back instead of running'),
      );
    }

    return result;
  }

  /**
   * Runs a metered call that reports failure by returning null instead of
   * throwing.
   *
   * Several AI methods are written that way -- they catch internally and
   * return null so a page can degrade rather than error. Without this, a null
   * return would be charged as a success, billing the customer for nothing.
   */
  async runNullable<T>(
    context: AiMeterContext,
    work: () => Promise<T | null>,
  ): Promise<T | null> {
    const { tenantId, userId, feature } = context;
    // runNullable backs features that already degrade to a rule-based answer
    // when AI produces nothing (daily report summary, guard recommendation).
    // So when AI is not on the plan, return null and let the caller fall back,
    // rather than throwing -- that keeps the surrounding non-AI feature working
    // for a Trial tenant instead of 403-ing it. No Gemini call is made.
    if (!(await this.entitlements.isAiEnabled(tenantId))) return null;
    const cost = this.costOf(feature);

    if (cost === 0) return work();

    await this.credits.spend({
      tenantId,
      userId,
      amount: cost,
      description: this.chargeDescription(feature, cost),
    });

    let result: T | null;
    try {
      result = await work();
    } catch (error) {
      await this.refund(tenantId, userId, feature, cost, error);
      throw error;
    }

    if (result === null || result === undefined) {
      await this.refund(
        tenantId,
        userId,
        feature,
        cost,
        new Error('the feature returned no result'),
      );
      return null;
    }

    return result;
  }

  /**
   * Hands the credits back after a call that produced nothing.
   *
   * Best effort: if the refund itself fails, the caller still needs to see the
   * original error, and a stranded charge is recoverable by hand from the
   * ledger -- whereas swallowing the AI error would hide a real fault. Logged
   * at error level precisely because it needs that manual correction.
   */
  private async refund(
    tenantId: string,
    userId: string | undefined,
    feature: AiFeature,
    cost: number,
    cause: unknown,
  ): Promise<void> {
    try {
      await this.credits.refundSpend({
        tenantId,
        userId,
        amount: cost,
        description: `Refund, ${this.labelFor(feature)} failed: ${cost} credit${
          cost === 1 ? '' : 's'
        }.`,
      });
    } catch (refundError) {
      this.logger.error(
        `Could not refund ${cost} credits to tenant ${tenantId} after ${feature} failed (${
          cause instanceof Error ? cause.message : String(cause)
        }). Refund error: ${
          refundError instanceof Error
            ? refundError.message
            : String(refundError)
        }. The charge stands and needs correcting by hand.`,
      );
    }
  }

  private chargeDescription(feature: AiFeature, cost: number): string {
    return `${this.labelFor(feature)}: ${cost} credit${
      cost === 1 ? '' : 's'
    }.`;
  }

  /** Human-readable feature name for the ledger description. */
  private labelFor(feature: AiFeature): string {
    const words = feature.toLowerCase().split('_').filter(Boolean).join(' ');
    return words.charAt(0).toUpperCase() + words.slice(1);
  }
}
