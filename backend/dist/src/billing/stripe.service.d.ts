import Stripe from 'stripe';
import { PrismaService } from '../prisma/prisma.service';
import { GuardBand, PackageKey } from './pricing.constants';
import { CreditPackKey } from './credit-packs.constants';
export declare class StripeService {
    private readonly prisma;
    private readonly logger;
    private client;
    constructor(prisma: PrismaService);
    get configured(): boolean;
    private stripe;
    private customerIdFor;
    private planPriceCache;
    planPrices(): Promise<Map<string, Stripe.Price>>;
    sellablePlans(): Promise<Record<PackageKey, GuardBand[]>>;
    createPlanCheckoutSession(params: {
        tenantId: string;
        packageKey: PackageKey;
        band: GuardBand;
        email?: string;
    }): Promise<{
        url: string | null;
        changed: boolean;
    }>;
    currentPlanLookupKey(tenantId: string): Promise<string | null>;
    private priceMatchesPlan;
    private liveSubscriptionFor;
    createCreditPackCheckoutSession(params: {
        tenantId: string;
        pack: CreditPackKey;
        email?: string;
    }): Promise<{
        url: string | null;
        sessionId: string;
    }>;
    private assertPriceMatchesPack;
    checkoutSessionForPaymentIntent(paymentIntentId: string): Promise<Stripe.Checkout.Session | null>;
    priceIdsForCheckoutSession(sessionId: string): Promise<string[]>;
    createPortalSession(tenantId: string): Promise<{
        url: string;
    }>;
    constructEvent(rawBody: Buffer, signature: string): Stripe.Event;
    priceIdsForSubscription(subscriptionId: string): Promise<string[]>;
    retrieveSubscription(subscriptionId: string): Promise<import("stripe/cjs/lib").Response<import("stripe/cjs/resources/Subscriptions").Subscription>>;
}
