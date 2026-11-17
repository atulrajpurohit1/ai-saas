import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma, TelephonyConnection } from '@prisma/client';
import { randomBytes } from 'crypto';
import { AuditService } from '../audit/audit.service';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import { decryptSecret, encryptSecret, telephonySecret } from '../common/secret-box.util';
import {
  RingCentralApiError,
  RingCentralClientService,
} from './ringcentral-client.service';
import { RingCentralSubscriptionService } from './ringcentral-subscription.service';
import {
  RINGCENTRAL_SCOPES,
  ringcentralConfigurationGaps,
  ringcentralIsConfigured,
  ringcentralUsesProduction,
} from './ringcentral.config';
import { ConnectRingCentralDto } from './dto/connect-ringcentral.dto';

const PROVIDER = 'ringcentral';

interface AccountInfo {
  id?: string | number;
  name?: string;
  companyName?: string;
  mainNumber?: string;
}

/**
 * Owns the tenant's RingCentral connection: the stored JWT credential, the
 * account it maps to, and the connect/disconnect lifecycle.
 */
@Injectable()
export class RingCentralConnectionService {
  private readonly logger = new Logger(RingCentralConnectionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly client: RingCentralClientService,
    private readonly subscriptions: RingCentralSubscriptionService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * What the Integrations screen renders. Safe to call with nothing
   * configured -- that is the normal state before the RingCentral app exists.
   */
  async getStatus(user: ActiveUser) {
    const connection = await this.prisma.telephonyConnection.findUnique({
      where: { tenantId_provider: { tenantId: user.tenantId, provider: PROVIDER } },
    });

    return {
      provider: PROVIDER,
      label: 'RingCentral',
      configured: ringcentralIsConfigured(),
      configuration_gaps: ringcentralConfigurationGaps(),
      environment: ringcentralUsesProduction() ? 'production' : 'sandbox',
      scopes: RINGCENTRAL_SCOPES,
      docs_url:
        'https://developers.ringcentral.com/guide/authentication/jwt/quick-start',
      setup_steps: [
        'In RingCentral, open the Developer Console and go to Credentials.',
        'Create a JWT credential and choose "Only specific apps of my choice".',
        'Paste the Client ID shown on this page into that field.',
        'Copy the generated JWT and paste it below.',
      ],
      status: connection?.status || 'disconnected',
      connected: connection?.status === 'connected',
      external_account_id: connection?.externalAccountId || null,
      external_account_name: connection?.externalAccountName || null,
      subscription_active: Boolean(connection?.subscriptionId),
      subscription_expires_at: connection?.subscriptionExpiresAt || null,
      last_sync_at: connection?.lastSyncAt || null,
      last_error: connection?.lastError || null,
    };
  }

  /**
   * Stores a tenant's JWT credential and starts event delivery.
   *
   * The credential is proved against RingCentral BEFORE anything is written,
   * so a typo fails here with a usable message rather than silently producing
   * a connection that never delivers a call.
   */
  async connect(user: ActiveUser, dto: ConnectRingCentralDto) {
    if (!ringcentralIsConfigured()) {
      throw new BadRequestException(
        'RingCentral is not configured on this server. Missing: ' +
          ringcentralConfigurationGaps().join(', '),
      );
    }

    const jwt = dto.credential.trim();
    const account = await this.verifyCredential(user.tenantId, jwt);

    const existing = await this.prisma.telephonyConnection.findUnique({
      where: { tenantId_provider: { tenantId: user.tenantId, provider: PROVIDER } },
    });

    let connection: TelephonyConnection;
    try {
      connection = await this.prisma.telephonyConnection.upsert({
        where: {
          tenantId_provider: { tenantId: user.tenantId, provider: PROVIDER },
        },
        update: {
          status: 'connected',
          credential: encryptSecret(jwt, telephonySecret()),
          externalAccountId: account.id,
          externalAccountName: account.name,
          scopes: RINGCENTRAL_SCOPES,
          lastError: null,
        },
        create: {
          tenantId: user.tenantId,
          provider: PROVIDER,
          status: 'connected',
          credential: encryptSecret(jwt, telephonySecret()),
          externalAccountId: account.id,
          externalAccountName: account.name,
          scopes: RINGCENTRAL_SCOPES,
          // Rotated on every reconnect, so a URL leaked from an old
          // subscription stops being useful the moment the tenant reconnects.
          webhookSecret: randomBytes(24).toString('base64url'),
        },
      });
    } catch (error) {
      throw this.translateWriteError(error);
    }

    // Credential is stored; event delivery is a separate failure domain. A
    // subscription failure must not lose the credential, or the tenant would
    // have to paste it again to retry something that was not their fault.
    try {
      connection = await this.subscriptions.create(connection, jwt);
    } catch (error) {
      const message = this.describe(error);
      await this.prisma.telephonyConnection.update({
        where: { id: connection.id },
        data: { status: 'degraded', lastError: message },
      });

      throw new ServiceUnavailableException(
        `RingCentral was connected, but call events could not be switched on: ${message}`,
      );
    }

    await this.auditService.log({
      tenantId: user.tenantId,
      userId: user.sub,
      action: existing ? 'TELEPHONY_RECONNECTED' : 'TELEPHONY_CONNECTED',
      entityType: 'TelephonyConnection',
      entityId: connection.id,
      details: `RingCentral connected (${account.name || account.id || 'account'})`,
    });

    return this.getStatus(user);
  }

  async disconnect(user: ActiveUser) {
    const connection = await this.prisma.telephonyConnection.findUnique({
      where: { tenantId_provider: { tenantId: user.tenantId, provider: PROVIDER } },
    });
    if (!connection) throw new NotFoundException('RingCentral is not connected');

    // Best effort: a subscription we cannot delete (revoked credential, say)
    // must not block the tenant from disconnecting. RingCentral expires it on
    // its own once nothing renews it.
    try {
      await this.subscriptions.remove(connection, this.credentialOf(connection));
    } catch (error) {
      this.logger.warn(
        `Could not delete RingCentral subscription for tenant ${user.tenantId}: ` +
          this.describe(error),
      );
    }

    this.client.invalidate(connection.id);
    await this.prisma.telephonyConnection.delete({ where: { id: connection.id } });

    await this.auditService.log({
      tenantId: user.tenantId,
      userId: user.sub,
      action: 'TELEPHONY_DISCONNECTED',
      entityType: 'TelephonyConnection',
      entityId: connection.id,
      details: 'RingCentral disconnected',
    });

    return { provider: PROVIDER, disconnected: true };
  }

  /** Decrypts a stored credential. The only place that happens. */
  credentialOf(connection: TelephonyConnection): string {
    return decryptSecret(connection.credential, telephonySecret());
  }

  /** The tenant's connection, or null. Used by the sync and dial paths. */
  async findForTenant(tenantId: string) {
    return this.prisma.telephonyConnection.findUnique({
      where: { tenantId_provider: { tenantId, provider: PROVIDER } },
    });
  }

  /** Routes an inbound webhook back to a tenant by its path secret. */
  async findByWebhookSecret(secret: string) {
    if (!secret) return null;
    return this.prisma.telephonyConnection.findFirst({
      where: { provider: PROVIDER, webhookSecret: secret },
    });
  }

  async recordError(connectionId: string, message: string) {
    await this.prisma.telephonyConnection
      .update({
        where: { id: connectionId },
        data: { status: 'degraded', lastError: message.slice(0, 500) },
      })
      .catch(() => undefined);
  }

  /**
   * Proves the JWT works and resolves which RingCentral account it belongs to.
   *
   * The account id is what webhook payloads carry, so without it a delivery
   * could not be tied back to a tenant.
   */
  private async verifyCredential(tenantId: string, jwt: string) {
    // No connection row exists yet, so the token cache is keyed on the tenant
    // and dropped straight after -- leaving it would strand a cache entry
    // under a key nothing else ever reads.
    const cacheKey = `verify:${tenantId}`;
    try {
      const account = await this.client.request<AccountInfo>(
        cacheKey,
        jwt,
        '/restapi/v1.0/account/~',
      );

      return {
        id: account.id != null ? String(account.id) : null,
        name: account.companyName || account.name || account.mainNumber || null,
      };
    } catch (error) {
      if (error instanceof RingCentralApiError) {
        if (error.isCredentialFailure) {
          throw new BadRequestException(
            'RingCentral rejected that credential. Check the JWT was copied in ' +
              'full and that it permits this application.',
          );
        }
        if (error.isPermissionFailure) {
          throw new BadRequestException(
            'That credential is valid but lacks the permissions this ' +
              'integration needs. Required: ' +
              RINGCENTRAL_SCOPES.join(', '),
          );
        }
      }
      throw error;
    } finally {
      this.client.invalidate(cacheKey);
    }
  }

  /**
   * A RingCentral account may back only one tenant. Without this, two tenants
   * could connect the same account and each would receive the other's calls --
   * a cross-tenant data leak through an integration rather than a query.
   */
  private translateWriteError(error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return new ConflictException(
        'That RingCentral account is already connected to another AegisLead ' +
          'account. Disconnect it there first.',
      );
    }
    return error;
  }

  private describe(error: unknown) {
    return error instanceof Error ? error.message : 'unknown error';
  }
}
