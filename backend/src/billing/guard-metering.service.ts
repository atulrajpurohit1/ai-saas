import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import {
  GuardBand,
  PackageKey,
  billableBand,
  isCustomQuote,
  monthlyPrice,
  packageForModules,
} from './pricing.constants';

/**
 * Works out which guard band a tenant is billed at.
 *
 * Billable headcount is EVERY guard on the books, not a rolling-activity
 * window: a guard added during the month is charged for that whole month even
 * if they leave part-way through. Confirmed by Anthony on 2026-10-09, and it
 * is the rule the price table assumes.
 *
 * This replaced an earlier "active in the last 30 days" definition. That
 * version under-counted on purpose, to avoid billing for leavers, but it was
 * our assumption rather than a decision and it silently discounted every
 * account with rota churn.
 *
 * Tenants without Guard Tour are counted as zero -- a Generation-only customer
 * is on the base band whatever their headcount.
 */

@Injectable()
export class GuardMeteringService {
  private readonly logger = new Logger(GuardMeteringService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlements: EntitlementsService,
  ) {}

  /**
   * Guards this tenant is billed for: every guard on the books.
   *
   * Named "billable" rather than "active" because there is no activity test --
   * a guard counts from the moment they are added, for the rest of the month.
   */
  async billableGuardCount(tenantId: string): Promise<number> {
    return this.prisma.guard.count({ where: { tenantId } });
  }

  /** Every guard on the books. Same figure, kept for transparency in the UI. */
  async totalGuardCount(tenantId: string): Promise<number> {
    return this.prisma.guard.count({ where: { tenantId } });
  }

  /**
   * What this tenant should be paying, based on what they have bought and how
   * many guards they are actually running.
   */
  async billingProfile(tenantId: string) {
    const modules = [...(await this.entitlements.modulesForTenant(tenantId))];
    const packageKey = packageForModules(modules);

    const [billableGuards, totalGuards] = await Promise.all([
      this.billableGuardCount(tenantId),
      this.totalGuardCount(tenantId),
    ]);

    if (!packageKey) {
      // A combination outside the four packages, e.g. Generation + Guard but
      // not Operations. Priced by arrangement rather than from the table.
      return {
        packageKey: null,
        packageName: 'Custom',
        band: null,
        billableGuards,
        totalGuards,
        monthlyPrice: null,
        customQuote: true,
      };
    }

    const band = billableBand(packageKey, billableGuards);
    const price = monthlyPrice(packageKey, band);

    return {
      packageKey,
      band,
      billableGuards,
      totalGuards,
      monthlyPrice: price,
      customQuote: isCustomQuote(band),
    };
  }

  /**
   * Whether a tenant has outgrown the band they are paying for.
   *
   * Deliberately read-only: it reports the difference rather than changing
   * anything. Moving a customer up a band changes what they are charged, and
   * that should be a deliberate act by a person, not a side effect of someone
   * adding a guard to a rota.
   */
  async bandDrift(tenantId: string, currentBand: GuardBand | null) {
    const profile = await this.billingProfile(tenantId);

    if (!profile.band || !currentBand || profile.band === currentBand) {
      return { drifted: false, from: currentBand, to: profile.band };
    }

    this.logger.log(
      `Tenant ${tenantId} has moved from band ${currentBand} to ${profile.band} ` +
        `(${profile.billableGuards} billable guards).`,
    );

    return {
      drifted: true,
      from: currentBand,
      to: profile.band,
      billableGuards: profile.billableGuards,
    };
  }

  /** The published table, for the pricing page. */
  priceFor(packageKey: PackageKey, band: GuardBand) {
    return monthlyPrice(packageKey, band);
  }
}
