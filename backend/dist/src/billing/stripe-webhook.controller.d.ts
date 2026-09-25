import { Request } from 'express';
import { StripeService } from './stripe.service';
import { StripeWebhookService } from './stripe-webhook.service';
export declare class StripeWebhookController {
    private readonly stripe;
    private readonly webhooks;
    private readonly logger;
    constructor(stripe: StripeService, webhooks: StripeWebhookService);
    handleStripe(req: Request & {
        rawBody?: Buffer;
    }, signature?: string): Promise<{
        handled: boolean;
        reason: string;
        received: boolean;
    } | {
        handled: boolean;
        tenantId: string;
        reason?: undefined;
        received: boolean;
    }>;
}
