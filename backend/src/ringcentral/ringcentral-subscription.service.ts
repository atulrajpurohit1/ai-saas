import { Injectable, Logger } from '@nestjs/common';
import { TelephonyConnection } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RingCentralClientService } from './ringcentral-client.service';
import {
  ringcentralSubscriptionTtlSeconds,
  ringcentralWebhookBaseUrl,
} from './ringcentral.config';

/**
 * Account-wide telephony events. Chosen over the per-extension filter so one
 * subscription covers every rep in the tenant -- the extension filter would
 * need one subscription per user and a re-subscribe whenever staff change.
 */
const TELEPHONY_SESSIONS_FILTER = '/restapi/v1.0/account/~/telephony/sessions';

interface SubscriptionResponse {
  id?: string;
  status?: string;
  expirationTime?: string;
  eventFilters?: string[];
}

/**
 * Creates, renews and deletes the RingCentral webhook subscription.
 *
 * RingCentral subscriptions expire. They also get suspended permanently if the
 * endpoint fails repeatedly, which is why renewal failures are recorded on the
 * connection rather than swallowed: a silently dead subscription looks exactly
 * like a tenant who stopped making calls.
 */
@Injectable()
export class RingCentralSubscriptionService {
  private readonly logger = new Logger(RingCentralSubscriptionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly client: RingCentralClientService,
  ) {}

  /**
   * The URL RingCentral posts to for this tenant.
   *
   * The per-connection secret sits in the PATH rather than a query string:
   * RingCentral signs nothing and sends no shared secret of its own, so this
   * value is the only thing distinguishing a genuine delivery from anyone who
   * learned the endpoint. Query strings are the likelier of the two to be
   * dropped by a proxy or written to an access log.
   */
  webhookUrlFor(connection: Pick<TelephonyConnection, 'webhookSecret'>): string {
    return `${ringcentralWebhookBaseUrl()}/ringcentral/webhook/${connection.webhookSecret}`;
  }

  /**
   * Creates the subscription and records its id and expiry.
   *
   * Any subscription already recorded is removed first, so a reconnect does
   * not leave an orphan delivering duplicate events to a stale URL.
   */
  async create(connection: TelephonyConnection, jwt: string) {
    if (connection.subscriptionId) {
      await this.remove(connection, jwt).catch(() => undefined);
    }

    const response = await this.client.request<SubscriptionResponse>(
      connection.id,
      jwt,
      '/restapi/v1.0/subscription',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventFilters: [TELEPHONY_SESSIONS_FILTER],
          deliveryMode: {
            transportType: 'WebHook',
            address: this.webhookUrlFor(connection),
          },
          expiresIn: ringcentralSubscriptionTtlSeconds(),
        }),
      },
    );

    return this.persist(connection.id, response);
  }

  /**
   * Renews before expiry.
   *
   * A PUT to the subscription renews it whether or not a body is sent; the
   * event filters are resent so a filter list that drifted (a scope was added,
   * say) is corrected by the same call.
   */
  async renew(connection: TelephonyConnection, jwt: string) {
    if (!connection.subscriptionId) {
      return this.create(connection, jwt);
    }

    try {
      const response = await this.client.request<SubscriptionResponse>(
        connection.id,
        jwt,
        `/restapi/v1.0/subscription/${connection.subscriptionId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ eventFilters: [TELEPHONY_SESSIONS_FILTER] }),
        },
      );
      return this.persist(connection.id, response);
    } catch (error) {
      // A subscription that expired or was suspended cannot be renewed -- the
      // id is gone. Recreating is the only recovery, and doing it here means a
      // tenant whose endpoint had an outage heals on the next scheduler run
      // instead of needing somebody to press Reconnect.
      this.logger.warn(
        `Renewal failed for connection ${connection.id}; recreating. ` +
          `${error instanceof Error ? error.message : 'unknown error'}`,
      );
      return this.create({ ...connection, subscriptionId: null }, jwt);
    }
  }

  async remove(connection: TelephonyConnection, jwt: string) {
    if (!connection.subscriptionId) return;

    await this.client.request(
      connection.id,
      jwt,
      `/restapi/v1.0/subscription/${connection.subscriptionId}`,
      { method: 'DELETE' },
    );

    await this.prisma.telephonyConnection.update({
      where: { id: connection.id },
      data: { subscriptionId: null, subscriptionExpiresAt: null },
    });
  }

  /**
   * Stores whatever expiry the server actually granted.
   *
   * RingCentral documents no maximum for expiresIn, so the request may be
   * clamped silently. Reading the expiry back means the renewal scheduler
   * works off the truth rather than off what we asked for.
   */
  private async persist(connectionId: string, response: SubscriptionResponse) {
    const expiresAt = response.expirationTime
      ? new Date(response.expirationTime)
      : null;

    return this.prisma.telephonyConnection.update({
      where: { id: connectionId },
      data: {
        subscriptionId: response.id || null,
        subscriptionExpiresAt:
          expiresAt && !Number.isNaN(expiresAt.getTime()) ? expiresAt : null,
        lastError: null,
      },
    });
  }
}
