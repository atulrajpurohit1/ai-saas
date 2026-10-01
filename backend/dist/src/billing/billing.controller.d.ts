import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { BillingService } from './billing.service';
import { StripeService } from './stripe.service';
import { CreateCheckoutSessionDto } from './dto/create-checkout-session.dto';
import { GuardMeteringService } from './guard-metering.service';
import { GuardBand, PackageKey } from './pricing.constants';
export declare class BillingController {
    private readonly billingService;
    private readonly stripe;
    private readonly metering;
    private readonly logger;
    constructor(billingService: BillingService, stripe: StripeService, metering: GuardMeteringService);
    getBilling(user: ActiveUser): Promise<{
        tenant: {
            id: string;
            slug: string;
            name: string;
            createdAt: Date;
        } | null;
        plan: {
            key: "free" | "starter" | "growth" | "enterprise";
            name: string;
            monthlyPrice: number | null;
            source: string;
        };
        limits: Record<string, any>;
        features: {
            salesAccelerator: boolean;
            salesAutomation: boolean;
            publicApi: boolean;
            customDomains: boolean;
            prioritySupport: boolean;
        };
        entitlements: {
            status: import(".prisma/client").$Enums.SubscriptionStatus;
            trialEndsAt: Date | null;
            currentPeriodEnd: Date | null;
            cancelAtPeriodEnd: boolean;
            modules: {
                key: import(".prisma/client").$Enums.ServiceModule;
                name: string;
                active: boolean;
            }[];
        };
        availablePlans: {
            key: string;
            name: string;
            monthlyPrice: number | null;
            limits: {
                branches: number | null;
                deals: number | null;
                leads: number | null;
                clientUsers: number | null;
                adminUsers: number | null;
            };
        }[];
    }>;
    checkoutAvailability(): Promise<{
        configured: boolean;
        plans: Record<PackageKey, GuardBand[]>;
    }>;
    plan(user: ActiveUser): Promise<{
        configured: boolean;
        bands: {
            key: GuardBand;
            min: number;
            max: number | null;
        }[];
        packages: {
            key: PackageKey;
            name: string;
            modules: import(".prisma/client").$Enums.ServiceModule[];
            monthly: Record<GuardBand, number | null>;
            sellableBands: GuardBand[];
        }[];
        generationOnlyBand: GuardBand;
        activeGuards: number;
        minimumBand: GuardBand;
        current: {
            packageKey: PackageKey;
            band: GuardBand;
        } | null;
    }>;
    pricing(): {
        bands: {
            key: GuardBand;
            min: number;
            max: number | null;
        }[];
        packages: {
            key: string;
            name: string;
            modules: import(".prisma/client").$Enums.ServiceModule[];
            monthly: Record<GuardBand, number | null>;
        }[];
    };
    usage(user: ActiveUser): Promise<{
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
    createCheckoutSession(user: ActiveUser, dto: CreateCheckoutSessionDto): Promise<{
        url: string | null;
        changed: boolean;
    }>;
    createPortalSession(user: ActiveUser): Promise<{
        url: string;
    }>;
    private billableBandFor;
    private sellablePlansOrNone;
    private currentPlan;
}
