import { ServiceModule } from '@prisma/client';
export type PackageKey = 'GENERATION' | 'GUARD' | 'OPERATIONS' | 'COMPLETE';
export type GuardBand = '1-25' | '26-50' | '51-100' | '101-250' | '251-500' | '500+';
export declare const GUARD_BANDS: {
    key: GuardBand;
    min: number;
    max: number | null;
}[];
export declare const PACKAGE_LABELS: Record<PackageKey, string>;
export declare const PACKAGE_MODULES: Record<PackageKey, ServiceModule[]>;
export declare const MONTHLY_PRICES: Record<PackageKey, Record<GuardBand, number | null>>;
export declare const GENERATION_ONLY_BAND: GuardBand;
export declare function bandForGuardCount(count: number): GuardBand;
export declare function packageForModules(modules: ServiceModule[]): PackageKey | null;
export declare function billableBand(packageKey: PackageKey, activeGuards: number): GuardBand;
export declare function monthlyPrice(packageKey: PackageKey, band: GuardBand): number | null;
export declare function isCustomQuote(band: GuardBand): band is "500+";
export declare const PACKAGE_KEYS: PackageKey[];
export declare function bandRank(band: GuardBand): number;
export declare function isGuardBand(value: string): value is GuardBand;
export declare function isPackageKey(value: string): value is PackageKey;
export declare function planLookupKey(packageKey: PackageKey, band: GuardBand): string | null;
export declare function allPlanLookupKeys(): string[];
export declare function planForLookupKey(lookupKey: string | null | undefined): {
    packageKey: PackageKey;
    band: GuardBand;
} | null;
