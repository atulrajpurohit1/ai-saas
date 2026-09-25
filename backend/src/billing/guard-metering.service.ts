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
 * The Guard model has no active/inactive flag, so "active guards" is defined
 * here as guards with at least one shift assignment in the last 30 days. That
 * matters commercially: counting every guard row ever created would bill a
 * customer for leavers they removed from the rota months ago, and the first
 * invoice dispute would be entirely justified.
 *
 * Tenants without Guard Tour are counted as zero -- a Generation-only customer
 * is on the base band whatever their headcount.
 */
const ACTIVE_WINDOW_DAYS = 30;

@Injectable()
export class GuardMeteringService {
  private readonly logger = new Logger(GuardMeteringService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlements: EntitlementsService,
  ) {}

  /** Guards with a shift assignment in the last 30 days. */
  async activeGuardCount(tenantId: string): Promise<number> {
    const since = new Date(
      Date.now() - ACTIVE_WINDOW_DAYS * 24 * 60 * 60 * 1000,
    );

    const active = await this.prisma.guard.count({
      where: {
        tenantId,
        assignments: {
          some: { shift: { startTime: { gte: since } } },
        },
      },
    });

    return active;
  }

  /** Every guard on the books, active or not. Shown for transparency. */
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

    const [activeGuards, totalGuards] = await Promise.all([
      this.activeGuardCount(tenantId),
      this.totalGuardCount(tenantId),
    ]);

    if (!packageKey) {
      // A combination outside the four packages, e.g. Generation + Guard but
      // not Operations. Priced by arrangement rather than from the table.
      return {
        packageKey: null,
        packageName: 'Custom',
        band: null,
        activeGuards,
        totalGuards,
        monthlyPrice: null,
        customQuote: true,
      };
    }

    const band = billableBand(packageKey, activeGuards);
    const price = monthlyPrice(packageKey, band);

    return {
      packageKey,
      band,
      activeGuards,
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
        `(${profile.activeGuards} active guards).`,
    );

    return {
      drifted: true,
      from: currentBand,
      to: profile.band,
      activeGuards: profile.activeGuards,
    };
  }

  /** The published table, for the pricing page. */
  priceFor(packageKey: PackageKey, band: GuardBand) {
    return monthlyPrice(packageKey, band);
  }
}
