import { ServiceModule } from '@prisma/client';
export type BillingInterval = 'monthly' | 'annual';
export declare function moduleForPriceId(priceId: string): ServiceModule | null;
export declare function stripeSecretKey(): string | null;
export declare function stripeWebhookSecret(): string | null;
export declare function billingReturnUrls(): {
    success: string;
    cancel: string;
    portalReturn: string;
    creditsSuccess: string;
    creditsCancel: string;
};
export declare function trialDays(): number | null;
export declare function isCheckoutConfigured(): boolean;
