import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Logger,
  Param,
  Post,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { RingCentralSyncService } from './ringcentral-sync.service';

/**
 * RingCentral's inbound webhook.
 *
 * Deliberately unauthenticated: RingCentral cannot present a JWT, signs
 * nothing, and sends no shared secret of its own. The unguessable secret in
 * the URL path IS the authentication, and it is per-tenant, so a leaked URL
 * exposes one tenant rather than all of them. Rotated on every reconnect.
 *
 * Two hard rules govern everything here:
 *
 * 1. ALWAYS return 200, even on a payload we cannot use. RingCentral suspends
 *    a subscription PERMANENTLY after repeated non-200s or an endpoint
 *    outage, and a suspended subscription looks exactly like a tenant who
 *    stopped making calls -- silent, and only noticed weeks later.
 * 2. Return FAST. Nothing slow runs on this thread; the handler records the
 *    call and lets the reconciliation sweep do the API work.
 */
@Controller('ringcentral/webhook')
export class RingCentralWebhookController {
  private readonly logger = new Logger(RingCentralWebhookController.name);

  constructor(private readonly sync: RingCentralSyncService) {}

  @Post(':secret')
  @HttpCode(200)
  async handle(
    @Param('secret') secret: string,
    @Body() payload: unknown,
    @Res({ passthrough: true }) res: Response,
    @Headers('validation-token') validationToken?: string,
  ) {
    // The subscription handshake. RingCentral POSTs once when the subscription
    // is created and expects the token echoed straight back; the subscription
    // is not activated until it is. It arrives BEFORE any connection could
    // have been looked up by some payloads, so it is answered first and
    // unconditionally.
    if (validationToken) {
      res.setHeader('Validation-Token', validationToken);
      return { ok: true };
    }

    try {
      const connection = await this.sync.connectionForSecret(secret);
      if (!connection) {
        // Wrong or rotated secret. Logged without the secret itself -- it is a
        // live credential for whichever tenant it belongs to.
        this.logger.warn(
          'RingCentral webhook received for an unknown or rotated endpoint.',
        );
        return { received: true };
      }

      await this.sync.ingestTelephonyEvent(connection, payload);
    } catch (error) {
      // Swallowed on purpose, per rule 1 above. The error is logged and the
      // reconciliation sweep is the backstop: a dropped event becomes a call
      // that syncs late, not a subscription that dies.
      this.logger.error(
        `Failed handling RingCentral webhook: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    }

    return { received: true };
  }
}
