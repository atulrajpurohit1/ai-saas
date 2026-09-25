import Stripe from 'stripe';
import { StripeService } from './stripe.service';
import { SubscriptionProvisioningService } from './subscription-provisioning.service';
export declare class StripeWebhookService {
    private readonly stripe;
    private readonly provisioning;
    private readonly logger;
    constructor(stripe: StripeService, provisioning: SubscriptionProvisioningService);
    handle(event: Stripe.Event): Promise<{
        handled: boolean;
        reason: string;
    } | {
        handled: boolean;
        tenantId: string;
        reason?: undefined;
    }>;
    private onCheckoutCompleted;
    private onSubscriptionChanged;
    private onSubscriptionDeleted;
    private onPaymentFailed;
    private applySubscription;
    private modulesFor;
    private statusFor;
    private resolveTenant;
}
