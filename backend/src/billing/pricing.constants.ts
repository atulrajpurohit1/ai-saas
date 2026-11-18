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
 * The package a tenant is on, with Lead Gen understood as an ADD-ON.
 *
 * Lead Gen can sit alongside any other package: buying it adds a line to the
 * subscription rather than replacing one, because a company that patrols sites
 * and prospects for new ones needs both, and making them choose was never a
 * product decision -- it was a limitation of billing one price per tenant.
 *
 * So a tenant holding Guard Tour plus Lead Gen is on GUARD with an add-on, not
 * on a nameless custom arrangement. packageForModules answers the narrower
 * question -- which package is exactly this module set -- and still reports
 * null for that combination, which is why anything naming a tenant's plan
 * should ask this instead.
 *
 * Complete already includes Lead Gen, so it comes back as an exact match with
 * no add-on; there is nothing to add.
 */
export function resolvePackageForModules(modules: ServiceModule[]): {
  packageKey: PackageKey | null;
  /** Lead Gen held on top of a package that does not include it. */
  leadGenAddOn: boolean;
} {
  const exact = packageForModules(modules);
  if (exact) return { packageKey: exact, leadGenAddOn: false };

  if (!modules.includes('LEAD_GEN')) {
    return { packageKey: null, leadGenAddOn: false };
  }

  const withoutLeadGen = modules.filter((module) => module !== 'LEAD_GEN');
  const base = packageForModules(withoutLeadGen);
  return base
    ? { packageKey: base, leadGenAddOn: true }
    : { packageKey: null, leadGenAddOn: false };
}

/**
 * The band a tenant is billed at. Generation-only is pinned to the base band;
 * everything else follows the billable guard count.
 */
export function billableBand(
  packageKey: PackageKey,
  billableGuards: number,
): GuardBand {
  if (packageKey === 'GENERATION') return GENERATION_ONLY_BAND;
  return bandForGuardCount(billableGuards);
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

export const PACKAGE_KEYS = Object.keys(PACKAGE_LABELS) as PackageKey[];

/**
 * The packages that are actually sold by guard band -- i.e. the rows and
 * columns of the published price chart.
 *
 * GENERATION is deliberately absent. Lead Gen is no longer priced by guards at
 * all: it is sold as the three tiers in lead-gen-tiers.constants.ts, each a
 * flat monthly price with a credit allocation included, and it is shown above
 * the chart rather than inside it. Its rows stay in MONTHLY_PRICES because
 * subscriptions sold under the old band prices still resolve through
 * planForLookupKey -- removing them would leave an existing Generation
 * customer's price unrecognised, and the webhook refuses to provision a
 * subscription whose prices it cannot read.
 */
export const GUARD_BAND_PACKAGE_KEYS: PackageKey[] = [
  'GUARD',
  'OPERATIONS',
  'COMPLETE',
];

/** Position of a band in the table, lowest first. */
export function bandRank(band: GuardBand): number {
  return GUARD_BANDS.findIndex((entry) => entry.key === band);
}

export function isGuardBand(value: string): value is GuardBand {
  return GUARD_BANDS.some((entry) => entry.key === value);
}

export function isPackageKey(value: string): value is PackageKey {
  return Object.prototype.hasOwnProperty.call(PACKAGE_LABELS, value);
}

/**
 * The Stripe lookup_key for a package's monthly price in a band, e.g.
 * `aegislead_guard_26_50_149usd_monthly`. Null for a band with no list price
 * (500+, quoted by sales).
 *
 * Checkout finds plan prices by this key instead of by env var: the table has
 * twenty sellable cells, and twenty hand-pasted price ids in the host's env is
 * twenty chances to sell the wrong one. The amount is part of the key, so a
 * price change in the table resolves to a NEW Stripe price rather than quietly
 * reusing the old one -- and checkout still checks the amount before selling.
 */
export function planLookupKey(
  packageKey: PackageKey,
  band: GuardBand,
): string | null {
  const price = monthlyPrice(packageKey, band);
  if (price === null) return null;
  const bandSlug = band.replace('+', '_plus').replace('-', '_');
  return `aegislead_${packageKey.toLowerCase()}_${bandSlug}_${price}usd_monthly`;
}

/** Every plan lookup key in the table, for listing the prices in one go. */
export function allPlanLookupKeys(): string[] {
  return PACKAGE_KEYS.flatMap((packageKey) =>
    GUARD_BANDS.map((band) => planLookupKey(packageKey, band.key)),
  ).filter((key): key is string => key !== null);
}

/**
 * Reverses planLookupKey. Used by the webhook to work out which services a
 * subscription pays for from the price Stripe reports, never from metadata.
 */
export function planForLookupKey(
  lookupKey: string | null | undefined,
): { packageKey: PackageKey; band: GuardBand } | null {
  if (!lookupKey) return null;
  for (const packageKey of PACKAGE_KEYS) {
    for (const band of GUARD_BANDS) {
      if (planLookupKey(packageKey, band.key) === lookupKey) {
        return { packageKey, band: band.key };
      }
    }
  }
  return null;
}
