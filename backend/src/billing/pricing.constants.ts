import { ServiceModule } from '@prisma/client';

/**
 * AegisLead pricing, as supplied by the client.
 *
 * Every package except Generation-only is priced by ACTIVE GUARD COUNT, so a
 * tenant's price moves as they grow. The amounts here are the published list
 * price and exist for display and for picking the right Stripe price id --
 * Stripe remains the source of truth for what is actually charged.
 */

export type PackageKey =
  | 'GENERATION'
  | 'GUARD'
  | 'OPERATIONS'
  | 'COMPLETE';

export type GuardBand =
  | '1-25'
  | '26-50'
  | '51-100'
  | '101-250'
  | '251-500'
  | '500+';

export const GUARD_BANDS: { key: GuardBand; min: number; max: number | null }[] =
  [
    { key: '1-25', min: 0, max: 25 },
    { key: '26-50', min: 26, max: 50 },
    { key: '51-100', min: 51, max: 100 },
    { key: '101-250', min: 101, max: 250 },
    { key: '251-500', min: 251, max: 500 },
    { key: '500+', min: 501, max: null },
  ];

export const PACKAGE_LABELS: Record<PackageKey, string> = {
  GENERATION: 'AegisLead Generation',
  GUARD: 'AegisLead Guard',
  OPERATIONS: 'AegisLead Operations',
  COMPLETE: 'AegisLead Complete',
};

/** Which services each package unlocks. */
export const PACKAGE_MODULES: Record<PackageKey, ServiceModule[]> = {
  GENERATION: ['LEAD_GEN'],
  GUARD: ['GUARD_TOUR'],
  OPERATIONS: ['FINANCE'],
  COMPLETE: ['LEAD_GEN', 'GUARD_TOUR', 'FINANCE'],
};

/**
 * Monthly list price in whole currency units. `null` means "Custom" -- the
 * 500+ band is quoted by sales, not sold self-serve.
 *
 * Generation is the exception to guard-band pricing: a Generation-only
 * customer pays the $299 base whatever their headcount, because it is a sales
 * tool and they may not track guards in the system at all. It still appears in
 * the higher bands for customers who reach it via Complete.
 */
export const MONTHLY_PRICES: Record<
  PackageKey,
  Record<GuardBand, number | null>
> = {
  GENERATION: {
    '1-25': 299,
    '26-50': 399,
    '51-100': 499,
    '101-250': 699,
    '251-500': 899,
    '500+': null,
  },
  GUARD: {
    '1-25': 99,
    '26-50': 149,
    '51-100': 249,
    '101-250': 399,
    '251-500': 599,
    '500+': null,
  },
  OPERATIONS: {
    '1-25': 199,
    '26-50': 299,
    '51-100': 449,
    '101-250': 699,
    '251-500': 999,
    '500+': null,
  },
  COMPLETE: {
    '1-25': 499,
    '26-50': 649,
    '51-100': 849,
    '101-250': 1199,
    '251-500': 1699,
    '500+': null,
  },
};

/**
 * A Generation-only customer pays the base band regardless of guard count.
 * Confirmed with the client: $299/mo flat.
 */
export const GENERATION_ONLY_BAND: GuardBand = '1-25';

export function bandForGuardCount(count: number): GuardBand {
  const band = GUARD_BANDS.find(
    (entry) => count >= entry.min && (entry.max === null || count <= entry.max),
  );
  return band?.key ?? '500+';
}

/** The package a set of purchased services corresponds to, if any. */
export function packageForModules(
  modules: ServiceModule[],
): PackageKey | null {
  const wanted = [...new Set(modules)].sort().join(',');

  for (const [key, included] of Object.entries(PACKAGE_MODULES)) {
    if ([...included].sort().join(',') === wanted) return key as PackageKey;
  }
  return null;
}

/**
 * The band a tenant is billed at. Generation-only is pinned to the base band;
 * everything else follows the active guard count.
 */
export function billableBand(
  packageKey: PackageKey,
  activeGuards: number,
): GuardBand {
  if (packageKey === 'GENERATION') return GENERATION_ONLY_BAND;
  return bandForGuardCount(activeGuards);
}

export function monthlyPrice(
  packageKey: PackageKey,
  band: GuardBand,
): number | null {
  return MONTHLY_PRICES[packageKey][band];
}

/** 500+ is quoted by sales rather than sold through checkout. */
export function isCustomQuote(band: GuardBand) {
  return band === '500+';
}

/** Stripe price id env var for a package/band, e.g. STRIPE_PRICE_GUARD_51_100. */
export function priceEnvKey(packageKey: PackageKey, band: GuardBand) {
  const suffix = band.replace('+', '_PLUS').replace('-', '_');
  return `STRIPE_PRICE_${packageKey}_${suffix}`;
}
