import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { GuardMeteringService } from './guard-metering.service';
import { StripeService } from './stripe.service';
import { isCheckoutConfigured } from './billing.config';
import {
  GuardBand,
  PACKAGE_LABELS,
  PackageKey,
  monthlyPrice,
  planForLookupKey,
} from './pricing.constants';

/** Statuses worth checking. A canceled subscription is not underbilled. */
const BILLABLE_STATUSES = ['ACTIVE', 'TRIALING', 'PAST_DUE'] as const;

export interface BandDriftRow {
  tenantId: string;
  tenantName: string;
  packageKey: PackageKey;
  fromBand: GuardBand;
  toBand: GuardBand;
  billableGuards: number;
  /** Monthly list price of the band they are on now. */
  currentPrice: number | null;
  /** Monthly list price of the band their headcount puts them in. */
  correctPrice: number | null;
  /** Monthly shortfall, or null when either side is a custom quote. */
  shortfall: number | null;
}

export interface BandDriftOutcome {
  tenantsChecked: number;
  drifted: BandDriftRow[];
  failures: number;
  /** Total monthly shortfall across every drifted tenant we could price. */
  monthlyShortfall: number;
  reported: boolean;
}

/**
 * Finds customers who have outgrown the guard band they are paying for.
 *
 * Every package except Generation-only is priced by guard count, and checkout
 * enforces that at purchase (BillingController.billableBandFor refuses a band
 * below the tenant's own headcount). Nothing re-checked afterwards:
 * GuardMeteringService.bandDrift existed to answer exactly this question and
 * had no callers at all, so a customer could buy Guard at the 1-25 band, grow
 * to 400 guards, and keep paying the 1-25 price indefinitely with nobody
 * notified. This closes that loop.
 *
 * Deliberately REPORT-ONLY, for the reason bandDrift already gives: moving a
 * customer up a band changes what they are charged, and that should be a
 * person's decision, not a side effect of someone adding a guard to a rota.
 * This service never touches Stripe subscriptions or TenantModule rows.
 *
 * One digest per sweep rather than one email per tenant, and nothing at all
 * when no account has drifted -- a daily "all correct" email trains the
 * recipient to ignore the alert that matters.
 */
@Injectable()
export class BandDriftService {
  private readonly logger = new Logger(BandDriftService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly metering: GuardMeteringService,
    private readonly stripe: StripeService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Where the digest goes. Internal, not the customer: an underbilled account
   * is a conversation for whoever owns pricing, and emailing the customer
   * "you owe us more" unprompted is not that conversation.
   *
   * Unset means log-only, which is the safe default for a fresh deployment.
   */
  private recipients(): string[] {
    return (this.config.get<string>('BILLING_DRIFT_ALERT_EMAIL') ?? '')
      .split(',')
      .map((address) => address.trim())
      .filter(Boolean);
  }

  async sweep(): Promise<BandDriftOutcome> {
    const empty: BandDriftOutcome = {
      tenantsChecked: 0,
      drifted: [],
      failures: 0,
      monthlyShortfall: 0,
      reported: false,
    };

    // Without Stripe there is no subscription to read a current band from, so
    // there is nothing to compare against. Not a failure -- a deployment that
    // has not been wired to Stripe yet has no paying customers to underbill.
    if (!isCheckoutConfigured()) {
      this.logger.log(
        'Stripe is not configured; skipping the guard band drift sweep.',
      );
      return empty;
    }

    const subscriptions = await this.prisma.tenantSubscription.findMany({
      where: {
        status: { in: [...BILLABLE_STATUSES] },
        providerSubscriptionId: { not: null },
      },
      select: { tenantId: true, tenant: { select: { name: true } } },
    });

    const drifted: BandDriftRow[] = [];
    let failures = 0;

    for (const subscription of subscriptions) {
      try {
        const row = await this.checkTenant(
          subscription.tenantId,
          subscription.tenant?.name ?? subscription.tenantId,
        );
        if (row) drifted.push(row);
      } catch (error) {
        // One unreadable subscription must not abandon the rest of the sweep.
        failures += 1;
        this.logger.error(
          `Could not check guard band for tenant ${subscription.tenantId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    const monthlyShortfall = drifted.reduce(
      (total, row) => total + (row.shortfall ?? 0),
      0,
    );

    const outcome: BandDriftOutcome = {
      tenantsChecked: subscriptions.length,
      drifted,
      failures,
      monthlyShortfall,
      reported: false,
    };

    if (drifted.length === 0) return outcome;

    for (const row of drifted) {
      this.logger.warn(
        `Tenant ${row.tenantName} (${row.tenantId}) is billed at ${PACKAGE_LABELS[row.packageKey]} ` +
          `${row.fromBand} but has ${row.billableGuards} billable guards, which is band ${row.toBand}` +
          (row.shortfall === null
            ? ' (custom quote; price difference not in the table).'
            : ` -- $${row.shortfall}/month under list price.`),
      );
    }

    outcome.reported = await this.sendDigest(drifted, monthlyShortfall);
    return outcome;
  }

  /** The drift row for one tenant, or null when their band is correct. */
  private async checkTenant(
    tenantId: string,
    tenantName: string,
  ): Promise<BandDriftRow | null> {
    const current = planForLookupKey(
      await this.stripe.currentPlanLookupKey(tenantId),
    );

    // No live subscription, or a price whose lookup_key is not in the table
    // (a hand-built or legacy price). Either way there is no band to compare,
    // and guessing one would be worse than reporting nothing.
    if (!current) return null;

    const drift = await this.metering.bandDrift(tenantId, current.band);
    if (!drift.drifted || !drift.to) return null;

    const currentPrice = monthlyPrice(current.packageKey, current.band);
    const correctPrice = monthlyPrice(current.packageKey, drift.to);

    return {
      tenantId,
      tenantName,
      packageKey: current.packageKey,
      fromBand: current.band,
      toBand: drift.to,
      billableGuards: drift.billableGuards ?? 0,
      currentPrice,
      correctPrice,
      // Null for the 500+ band, which is quoted by sales rather than priced
      // from the table. Reported as drift, just without a number attached.
      shortfall:
        currentPrice === null || correctPrice === null
          ? null
          : Math.max(0, correctPrice - currentPrice),
    };
  }

  private async sendDigest(
    drifted: BandDriftRow[],
    monthlyShortfall: number,
  ): Promise<boolean> {
    const recipients = this.recipients();

    if (recipients.length === 0) {
      this.logger.warn(
        `${drifted.length} tenant(s) have outgrown their guard band ` +
          `($${monthlyShortfall}/month under list price). Set ` +
          'BILLING_DRIFT_ALERT_EMAIL to receive this as a digest.',
      );
      return false;
    }

    try {
      await this.email.sendBandDriftDigestEmail({
        recipients,
        rows: drifted,
        monthlyShortfall,
      });
      return true;
    } catch (error) {
      // The drift is already logged above, so a failed send loses the
      // notification but not the finding.
      this.logger.error(
        `Could not send the guard band drift digest: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return false;
    }
  }
}
