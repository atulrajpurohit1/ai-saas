import Stripe from 'stripe';
import { ServiceModule } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BillingInterval } from './billing.config';
export declare class StripeService {
    private readonly prisma;
    private readonly logger;
    private client;
    constructor(prisma: PrismaService);
    get configured(): boolean;
    private stripe;
    private customerIdFor;
    createCheckoutSession(params: {
        tenantId: string;
        modules: ServiceModule[];
        interval: BillingInterval;
        email?: string;
    }): Promise<{
        url: string | null;
        sessionId: string;
    }>;
    createPortalSession(tenantId: string): Promise<{
        url: string;
    }>;
    constructEvent(rawBody: Buffer, signature: string): Stripe.Event;
    priceIdsForSubscription(subscriptionId: string): Promise<string[]>;
    retrieveSubscription(subscriptionId: string): Promise<import("stripe/cjs/lib").Response<import("stripe/cjs/resources/Subscriptions").Subscription>>;
}
