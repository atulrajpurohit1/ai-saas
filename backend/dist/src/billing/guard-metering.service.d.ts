import { PrismaService } from '../prisma/prisma.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { GuardBand, PackageKey } from './pricing.constants';
export declare class GuardMeteringService {
    private readonly prisma;
    private readonly entitlements;
    private readonly logger;
    constructor(prisma: PrismaService, entitlements: EntitlementsService);
    activeGuardCount(tenantId: string): Promise<number>;
    totalGuardCount(tenantId: string): Promise<number>;
    billingProfile(tenantId: string): Promise<{
        packageKey: null;
        packageName: string;
        band: null;
        activeGuards: number;
        totalGuards: number;
        monthlyPrice: null;
        customQuote: boolean;
    } | {
        packageKey: PackageKey;
        band: GuardBand;
        activeGuards: number;
        totalGuards: number;
        monthlyPrice: number | null;
        customQuote: boolean;
        packageName?: undefined;
    }>;
    bandDrift(tenantId: string, currentBand: GuardBand | null): Promise<{
        drifted: boolean;
        from: GuardBand | null;
        to: GuardBand | null;
        activeGuards?: undefined;
    } | {
        drifted: boolean;
        from: GuardBand;
        to: GuardBand;
        activeGuards: number;
    }>;
    priceFor(packageKey: PackageKey, band: GuardBand): number | null;
}
