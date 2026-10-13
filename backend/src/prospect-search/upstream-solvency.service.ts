import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CreditsService } from '../billing/credits.service';
import { UpstreamBudgetService } from './upstream-budget.service';

/**
 * Asks the one question the per-tenant cap cannot answer: is the prepaid
 * BlackPearl pot big enough for the credits we have already sold?
 *
 * The cap stops one tenant draining the pot. It does nothing about the pot
 * being too small in the first place, and that is a real risk here, because
 * credits are sold as one-off packs with no expiry: a customer can buy 7,000
 * credits today and spend them all next month. Every unspent credit is a
 * claim on a pot that may not be able to honour it, and the first symptom of
 * that is Prospect Search failing for everybody at once -- which is exactly
 * the failure the whole upstream guard exists to avoid.
 *
 * So the liability is compared with the balance on a schedule and logged at
 * ERROR when it does not cover. Nothing here can fix it: topping up the
 * BlackPearl balance is console-only (no API), and so is raising the auto
 * top-up. The alert exists so the shortfall is known before customers find
 * it.
 */

/**
 * USD we expect one customer credit to cost us upstream.
 *
 * Measured, not guessed, but it is an average over a mix we do not control.
 * From the 12 Oct 2026 figures in credit-packs.constants.ts: a playbook is
 * 200 credits and bills a median $9.97, which is $0.0499 per credit; a
 * preview-sized discovery is 50 credits and bills $0.39-$1.91, which is
 * $0.008-$0.038 per credit. Playbooks are the expensive end, so this default
 * is the conservative reading -- a tenant spending on previews costs less per
 * credit than this, never more.
 *
 * A full-sized discovery (200 credits) has never been measured, so no figure
 * here accounts for it.
 */
const DEFAULT_USD_PER_CREDIT = 0.05;

/** Warn while the pot still covers the liability, but only just. */
const HEADROOM_MULTIPLE = 1.25;

export interface UpstreamSolvency {
  /** Credits sold and not yet spent, across every tenant. */
  outstandingCredits: number;
  /** What those credits are expected to cost us upstream, in USD. */
  liabilityUsd: number;
  /** The prepaid pot, or null when it could not be read. */
  prepaidBalanceUsd: number | null;
  /** liabilityUsd covered by the pot, as a ratio. Null when unknown. */
  coverage: number | null;
}

@Injectable()
export class UpstreamSolvencyService {
  private readonly logger = new Logger(UpstreamSolvencyService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly creditsService: CreditsService,
    private readonly upstreamBudget: UpstreamBudgetService,
  ) {}

  private usdPerCredit(): number {
    const configured = Number(
      this.configService.get<string>('BLACKPEARL_USD_PER_CREDIT'),
    );
    return Number.isFinite(configured) && configured > 0
      ? configured
      : DEFAULT_USD_PER_CREDIT;
  }

  /**
   * The current position. Forces a fresh balance read: this runs on a
   * schedule, not on the search path, so the 60s cache buys nothing and a
   * stale figure would be reported as fact.
   */
  async getSolvency(): Promise<UpstreamSolvency> {
    const [outstandingCredits, prepaidBalanceUsd] = await Promise.all([
      this.creditsService.totalOutstandingCredits(),
      this.upstreamBudget.getBalanceUsd(true),
    ]);

    const liabilityUsd = outstandingCredits * this.usdPerCredit();

    return {
      outstandingCredits,
      liabilityUsd,
      prepaidBalanceUsd,
      coverage:
        prepaidBalanceUsd === null || liabilityUsd <= 0
          ? null
          : prepaidBalanceUsd / liabilityUsd,
    };
  }

  /**
   * Checks the position and logs it. ERROR when the pot cannot cover what we
   * have sold, because that is the state where an operator has to act and
   * only an operator can.
   */
  async check(): Promise<UpstreamSolvency> {
    const solvency = await this.getSolvency();
    const { outstandingCredits, liabilityUsd, prepaidBalanceUsd } = solvency;

    if (prepaidBalanceUsd === null) {
      // Same posture as the spend guard: unknown is not evidence of empty,
      // and a status endpoint being down is not a solvency problem.
      this.logger.warn(
        `Could not read the BlackPearl prepaid balance; solvency unknown. ${outstandingCredits} credits are outstanding, about $${liabilityUsd.toFixed(
          2,
        )} of upstream cost.`,
      );
      return solvency;
    }

    const position =
      `${outstandingCredits} credits outstanding, about $${liabilityUsd.toFixed(
        2,
      )} of upstream cost at $${this.usdPerCredit().toFixed(4)}/credit, ` +
      `against a $${prepaidBalanceUsd.toFixed(2)} prepaid balance`;

    if (liabilityUsd > prepaidBalanceUsd) {
      this.logger.error(
        `BlackPearl prepaid balance does NOT cover the credits already sold: ${position}. ` +
          `Short by about $${(liabilityUsd - prepaidBalanceUsd).toFixed(
            2,
          )}. Top the account up in the BlackPearl console -- there is no API for it, and if these credits are spent before it is topped up, Prospect Search stops for every tenant at once.`,
      );
      return solvency;
    }

    if (liabilityUsd * HEADROOM_MULTIPLE > prepaidBalanceUsd) {
      this.logger.warn(
        `BlackPearl prepaid balance covers the credits sold, but with little room: ${position}.`,
      );
      return solvency;
    }

    this.logger.log(`BlackPearl prepaid balance is healthy: ${position}.`);
    return solvency;
  }
}
