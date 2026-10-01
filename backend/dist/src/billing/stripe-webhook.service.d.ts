import Stripe from 'stripe';
import { CreditsService } from './credits.service';
import { StripeService } from './stripe.service';
import { SubscriptionProvisioningService } from './subscription-provisioning.service';
export declare class StripeWebhookService {
    private readonly stripe;
    private readonly provisioning;
    private readonly credits;
    private readonly logger;
    constructor(stripe: StripeService, provisioning: SubscriptionProvisioningService, credits: CreditsService);
    handle(event: Stripe.Event): Promise<{
        handled: boolean;
        tenantId: string;
        reason?: undefined;
    } | {
        handled: boolean;
        reason: string;
    }>;
    private onCheckoutCompleted;
    private onCreditPackPurchased;
    private onChargeRefunded;
    private onChargeDisputed;
    private reverseCreditsForPaymentIntent;
    private onSubscriptionChanged;
    private onSubscriptionDeleted;
    private onPaymentFailed;
    private applySubscription;
    private modulesFor;
    private statusFor;
    private resolveTenant;
}
