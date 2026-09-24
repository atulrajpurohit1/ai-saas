import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  Logger,
  Post,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { StripeService } from './stripe.service';
import { StripeWebhookService } from './stripe-webhook.service';

/**
 * Stripe's inbound webhook.
 *
 * Deliberately unauthenticated -- Stripe cannot present a JWT. The signature
 * check IS the authentication, so it runs before anything reads the payload.
 */
@Controller('billing/webhook')
export class StripeWebhookController {
  private readonly logger = new Logger(StripeWebhookController.name);

  constructor(
    private readonly stripe: StripeService,
    private readonly webhooks: StripeWebhookService,
  ) {}

  @Post('stripe')
  @HttpCode(200)
  async handleStripe(
    @Req() req: Request & { rawBody?: Buffer },
    @Headers('stripe-signature') signature?: string,
  ) {
    if (!signature) {
      throw new BadRequestException('Missing stripe-signature header.');
    }
    if (!req.rawBody) {
      // Would mean rawBody was turned off in main.ts. Fail loudly: silently
      // skipping verification here would let anyone grant themselves services.
      throw new BadRequestException('Raw request body unavailable.');
    }

    const event = this.stripe.constructEvent(req.rawBody, signature);

    try {
      const result = await this.webhooks.handle(event);
      return { received: true, ...result };
    } catch (error) {
      // Returning 200 on an unexpected failure would make Stripe drop the
      // event for good. Log it and let the 500 trigger their retry.
      this.logger.error(
        `Failed handling ${event.type} (${event.id}): ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
      throw error;
    }
  }
}
