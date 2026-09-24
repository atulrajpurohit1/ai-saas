import { ServiceModule } from '@prisma/client';
export type BillingInterval = 'monthly' | 'annual';
export declare function priceIdFor(module: ServiceModule, interval: BillingInterval): string | null;
export declare function moduleForPriceId(priceId: string): ServiceModule | null;
export declare function stripeSecretKey(): string | null;
export declare function stripeWebhookSecret(): string | null;
export declare function billingReturnUrls(): {
    success: string;
    cancel: string;
    portalReturn: string;
};
export declare function trialDays(): number | null;
export declare function isCheckoutConfigured(): boolean;
export declare function sellableModules(interval?: BillingInterval): import(".prisma/client").$Enums.ServiceModule[];
