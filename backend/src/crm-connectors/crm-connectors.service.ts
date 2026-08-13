import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { CrmConnection } from '@prisma/client';
import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  createHash,
  randomBytes,
} from 'crypto';
import { AuditService } from '../audit/audit.service';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import { SyncContactDto } from './dto/sync-contact.dto';
import {
  CRM_PROVIDERS,
  CrmApiError,
  CrmProviderAdapter,
  CrmTokenResponse,
} from './providers/crm-provider.interface';

@Injectable()
export class CrmConnectorsService {
  private readonly logger = new Logger(CrmConnectorsService.name);
  private readonly providers: Map<string, CrmProviderAdapter>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    @Inject(CRM_PROVIDERS) providers: CrmProviderAdapter[],
  ) {
    this.providers = new Map(providers.map((provider) => [provider.key, provider]));
  }

  async getStatus(user: ActiveUser) {
    const connections = await this.prisma.crmConnection.findMany({
      where: { tenantId: user.tenantId },
    });
    const connectionByProvider = new Map(
      connections.map((connection) => [connection.provider, connection]),
    );

    const status: Record<string, ReturnType<typeof this.serializeStatus>> = {};
    for (const provider of this.providers.values()) {
      const connection = connectionByProvider.get(provider.key);
      status[provider.key] = this.serializeStatus(provider, connection);
    }
    return status;
  }

  getConnectUrl(user: ActiveUser, providerKey: string) {
    const provider = this.requireProvider(providerKey);
    const state = this.signState({
      tenantId: user.tenantId,
      userId: user.sub,
      nonce: randomBytes(12).toString('base64url'),
      createdAt: Date.now(),
    });

    return { provider: provider.key, url: provider.buildAuthUrl(state) };
  }

  async handleCallback(
    providerKey: string,
    code: string | undefined,
    state: string | undefined,
  ) {
    const provider = this.requireProvider(providerKey);
    if (!provider.isConfigured()) {
      throw new BadRequestException(
        `${provider.label} OAuth environment variables are not configured`,
      );
    }
    if (!code) {
      throw new BadRequestException(`Missing ${provider.label} authorization code`);
    }
    const parsedState = this.verifyState(state);

    const token = await provider.exchangeCode(code);
    const accessToken = this.encrypt(token.access_token);
    const refreshToken = token.refresh_token
      ? this.encrypt(token.refresh_token)
      : null;
    const expiresAt = token.expires_in
      ? new Date(Date.now() + Number(token.expires_in) * 1000)
      : null;
    const meta = provider.extractAccountMeta(token);

    const connection = await this.prisma.crmConnection.upsert({
      where: {
        tenantId_provider: {
          tenantId: parsedState.tenantId,
          provider: provider.key,
        },
      },
      update: {
        status: 'connected',
        accessToken,
        refreshToken,
        tokenExpiresAt: expiresAt,
        scopes: this.scopeList(provider, token.scope),
        portalId: meta.portalId ?? undefined,
        externalAccountName: meta.externalAccountName,
        lastError: null,
      },
      create: {
        tenantId: parsedState.tenantId,
        provider: provider.key,
        status: 'connected',
        accessToken,
        refreshToken,
        tokenExpiresAt: expiresAt,
        scopes: this.scopeList(provider, token.scope),
        portalId: meta.portalId,
        externalAccountName: meta.externalAccountName,
      },
    });

    await this.auditService.log({
      tenantId: parsedState.tenantId,
      userId: parsedState.userId,
      action: 'CRM_CONNECTED',
      entityType: 'CrmConnection',
      entityId: connection.id,
      details: `${provider.label} connected`,
    });

    return connection;
  }

  async disconnect(user: ActiveUser, providerKey: string) {
    const provider = this.requireProvider(providerKey);
    const connection = await this.prisma.crmConnection.findUnique({
      where: {
        tenantId_provider: { tenantId: user.tenantId, provider: provider.key },
      },
    });

    if (!connection) {
      throw new NotFoundException(`${provider.label} is not connected`);
    }

    const updated = await this.prisma.crmConnection.update({
      where: { id: connection.id },
      data: {
        status: 'disconnected',
        accessToken: '',
        refreshToken: null,
        tokenExpiresAt: null,
      },
    });

    await this.auditService.log({
      tenantId: user.tenantId,
      userId: user.sub,
      action: 'CRM_DISCONNECTED',
      entityType: 'CrmConnection',
      entityId: connection.id,
      details: `${provider.label} disconnected`,
    });

    return this.serializeConnection(updated);
  }

  async importContacts(user: ActiveUser, providerKey: string) {
    const provider = this.requireProvider(providerKey);
    const connection = await this.activeConnection(provider, user.tenantId);

    const contacts = await this.callProvider(provider, connection, (accessToken) =>
      provider.fetchContacts(accessToken, connection.portalId),
    );

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const contact of contacts) {
      const name =
        [contact.firstName, contact.lastName].filter(Boolean).join(' ') ||
        contact.email ||
        `${provider.label} Contact`;
      const company = contact.company || `${provider.label} Contact`;

      if (!contact.email && !name) {
        skipped += 1;
        continue;
      }

      const existing = await this.prisma.lead.findFirst({
        where: {
          tenantId: user.tenantId,
          OR: contact.email
            ? [{ email: contact.email }, { name, company }]
            : [{ name, company }],
        },
      });

      if (existing) {
        await this.prisma.lead.update({
          where: { id: existing.id },
          data: {
            name,
            company,
            ...(contact.email ? { email: contact.email } : {}),
            status: contact.status,
          },
        });
        updated += 1;
      } else {
        await this.prisma.lead.create({
          data: {
            tenantId: user.tenantId,
            name,
            company,
            email: contact.email,
            status: contact.status,
          },
        });
        created += 1;
      }
    }

    await this.prisma.crmConnection.update({
      where: { id: connection.id },
      data: { lastSyncAt: new Date(), lastError: null },
    });

    await this.auditService.log({
      tenantId: user.tenantId,
      userId: user.sub,
      action: 'CRM_IMPORT',
      entityType: 'CrmConnection',
      entityId: connection.id,
      details: `Imported ${provider.label} contacts: ${created} created, ${updated} updated`,
    });

    return { provider: provider.key, total: contacts.length, created, updated, skipped };
  }

  async importProspectContact(
    user: ActiveUser,
    providerKey: string,
    dto: SyncContactDto,
  ) {
    const provider = this.requireProvider(providerKey);
    if (!provider.upsertContact) {
      throw new BadRequestException(
        `${provider.label} does not support syncing contacts yet`,
      );
    }
    if (!dto.contactEmail) {
      throw new BadRequestException(
        'An email address is required to sync a contact (needed to avoid creating duplicates).',
      );
    }

    const contact = this.toContactInput(dto);
    const connection = await this.activeConnection(provider, user.tenantId);
    const result = await this.callProvider(provider, connection, (accessToken) =>
      provider.upsertContact!(accessToken, connection.portalId, contact),
    );

    await this.prisma.crmConnection.update({
      where: { id: connection.id },
      data: { lastSyncAt: new Date(), lastError: null },
    });

    await this.auditService.log({
      tenantId: user.tenantId,
      userId: user.sub,
      action: 'CRM_CONTACT_SYNCED',
      entityType: 'CrmConnection',
      entityId: connection.id,
      details: `Synced prospect "${contact.name || contact.companyName || contact.email}" to ${provider.label} (${result.created ? 'created' : 'updated'})`,
    });

    return result;
  }

  callbackResultUrl(providerKey: string, success: boolean) {
    const params = new URLSearchParams({
      crm: success ? `${providerKey}_connected` : `${providerKey}_failed`,
    });
    return `${this.frontendUrl()}/integrations?${params.toString()}`;
  }

  private toContactInput(dto: SyncContactDto) {
    const noteLines: string[] = [];
    if (dto.qualificationReason) {
      noteLines.push(`Why this prospect matched: ${dto.qualificationReason}`);
    }
    if (dto.signals && dto.signals.length > 0) {
      noteLines.push('Signals:', ...dto.signals.map((signal) => `- ${signal}`));
    }

    return {
      name: dto.contactName?.trim() || dto.name,
      email: dto.contactEmail,
      companyName: dto.name,
      website: dto.website,
      city: dto.city,
      state: dto.state,
      country: dto.country,
      jobTitle: dto.contactTitle,
      linkedinUrl: dto.contactProfileUrl,
      note: noteLines.length > 0 ? noteLines.join('\n') : null,
    };
  }

  private requireProvider(providerKey: string) {
    const provider = this.providers.get(providerKey);
    if (!provider) {
      throw new BadRequestException(`Unknown CRM provider: ${providerKey}`);
    }
    return provider;
  }

  private async activeConnection(provider: CrmProviderAdapter, tenantId: string) {
    const connection = await this.prisma.crmConnection.findUnique({
      where: { tenantId_provider: { tenantId, provider: provider.key } },
    });

    if (!connection || connection.status === 'disconnected' || !connection.accessToken) {
      throw new BadRequestException(`${provider.label} is not connected`);
    }

    return connection;
  }

  /**
   * Runs a provider API call with the current access token, transparently
   * refreshing once on a 401 before giving up - GHL's tokens expire daily,
   * and a proactive refresh (see validAccessToken) can still race an
   * out-of-band revoke on GHL's side.
   */
  private async callProvider<T>(
    provider: CrmProviderAdapter,
    connection: CrmConnection,
    fn: (accessToken: string) => Promise<T>,
  ): Promise<T> {
    const accessToken = await this.validAccessToken(provider, connection);

    try {
      return await fn(accessToken);
    } catch (err) {
      if (!(err instanceof CrmApiError)) throw err;

      if (err.status === 401 && connection.refreshToken) {
        try {
          const refreshed = await provider.refreshToken(this.decrypt(connection.refreshToken));
          await this.persistRefreshedToken(connection, provider, refreshed);
          return await fn(refreshed.access_token);
        } catch {
          await this.markConnectionError(
            connection.id,
            `${provider.label} connection expired. Please reconnect.`,
          );
          throw new UnauthorizedException(
            `${provider.label} connection expired. Please reconnect.`,
          );
        }
      }

      throw await this.translateProviderError(provider, connection, err);
    }
  }

  private async translateProviderError(
    provider: CrmProviderAdapter,
    connection: CrmConnection,
    err: CrmApiError,
  ) {
    this.logger.warn(
      `${provider.label} API error for connection ${connection.id}: status=${err.status} message=${err.message}`,
    );

    if (err.status === 401) {
      await this.markConnectionError(
        connection.id,
        `${provider.label} connection expired. Please reconnect.`,
      );
      return new UnauthorizedException(`${provider.label} connection expired. Please reconnect.`);
    }
    if (err.status === 403) {
      await this.markConnectionError(
        connection.id,
        `${provider.label} denied this request. Please reconnect with the required permissions.`,
      );
      return new ForbiddenException(
        `${provider.label} denied this request. Please reconnect with the required permissions.`,
      );
    }
    if (err.status === 429) {
      return new HttpException(`${provider.label} rate limit reached. Please try again shortly.`, 429);
    }
    if (err.status >= 500) {
      await this.recordSyncError(connection.id, err.message);
      return new ServiceUnavailableException(`${provider.label} is temporarily unavailable. Please try again.`);
    }

    await this.recordSyncError(connection.id, err.message);
    return new BadRequestException(`${provider.label} rejected this request: ${err.message}`);
  }

  private async persistRefreshedToken(
    connection: CrmConnection,
    provider: CrmProviderAdapter,
    refreshed: CrmTokenResponse,
  ) {
    await this.prisma.crmConnection.update({
      where: { id: connection.id },
      data: {
        accessToken: this.encrypt(refreshed.access_token),
        refreshToken: refreshed.refresh_token
          ? this.encrypt(refreshed.refresh_token)
          : connection.refreshToken,
        tokenExpiresAt: refreshed.expires_in
          ? new Date(Date.now() + Number(refreshed.expires_in) * 1000)
          : connection.tokenExpiresAt,
        scopes: this.scopeList(provider, refreshed.scope),
      },
    });
  }

  private async validAccessToken(provider: CrmProviderAdapter, connection: CrmConnection) {
    const needsRefresh =
      connection.tokenExpiresAt &&
      connection.tokenExpiresAt.getTime() < Date.now() + 2 * 60 * 1000;

    if (!needsRefresh) {
      return this.decrypt(connection.accessToken);
    }

    if (!connection.refreshToken) {
      await this.markConnectionError(
        connection.id,
        `${provider.label} connection expired. Please reconnect.`,
      );
      throw new UnauthorizedException(`${provider.label} connection expired. Please reconnect.`);
    }

    try {
      const refreshed = await provider.refreshToken(this.decrypt(connection.refreshToken));
      await this.persistRefreshedToken(connection, provider, refreshed);
      return refreshed.access_token;
    } catch {
      await this.markConnectionError(
        connection.id,
        `${provider.label} connection expired. Please reconnect.`,
      );
      throw new UnauthorizedException(`${provider.label} connection expired. Please reconnect.`);
    }
  }

  private async markConnectionError(connectionId: string, message: string) {
    await this.prisma.crmConnection.update({
      where: { id: connectionId },
      data: { status: 'error', lastError: message.slice(0, 500) },
    });
  }

  private async recordSyncError(connectionId: string, message: string) {
    await this.prisma.crmConnection.update({
      where: { id: connectionId },
      data: { lastError: message.slice(0, 500) },
    });
  }

  private serializeStatus(provider: CrmProviderAdapter, connection?: CrmConnection) {
    return {
      configured: provider.isConfigured(),
      connected: connection?.status === 'connected',
      status: connection?.status || 'not_connected',
      portal_id: connection?.portalId || null,
      external_account_name: connection?.externalAccountName || null,
      scopes: connection?.scopes || provider.scopes,
      token_expires_at: connection?.tokenExpiresAt || null,
      last_sync_at: connection?.lastSyncAt || null,
      last_error: connection?.lastError || null,
    };
  }

  private serializeConnection(connection: CrmConnection) {
    return {
      provider: connection.provider,
      status: connection.status,
      portal_id: connection.portalId,
      external_account_name: connection.externalAccountName,
      scopes: connection.scopes,
      token_expires_at: connection.tokenExpiresAt,
      last_sync_at: connection.lastSyncAt,
      last_error: connection.lastError,
    };
  }

  private frontendUrl() {
    return (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/+$/, '');
  }

  private signState(payload: Record<string, unknown>) {
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = createHmac('sha256', this.secret()).update(body).digest('base64url');
    return `${body}.${sig}`;
  }

  private verifyState(state?: string) {
    if (!state) throw new BadRequestException('Missing OAuth state');
    const [body, sig] = state.split('.');
    const expected = createHmac('sha256', this.secret()).update(body).digest('base64url');
    if (!body || !sig || sig !== expected) {
      throw new BadRequestException('Invalid OAuth state');
    }
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as {
      tenantId: string;
      userId: string;
      createdAt: number;
    };
    if (!payload.tenantId || Date.now() - payload.createdAt > 15 * 60 * 1000) {
      throw new BadRequestException('Expired OAuth state');
    }
    return payload;
  }

  private encrypt(value: string) {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey(), iv);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`;
  }

  private decrypt(value: string) {
    const [ivText, tagText, encryptedText] = value.split('.');
    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.encryptionKey(),
      Buffer.from(ivText, 'base64url'),
    );
    decipher.setAuthTag(Buffer.from(tagText, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(encryptedText, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  }

  private encryptionKey() {
    return createHash('sha256').update(this.secret()).digest();
  }

  private secret() {
    return (
      process.env.CRM_TOKEN_SECRET ||
      process.env.JWT_ACCESS_SECRET ||
      'local-crm-token-secret'
    );
  }

  private scopeList(provider: CrmProviderAdapter, scope?: string) {
    return scope ? scope.split(/\s+/).filter(Boolean) : provider.scopes;
  }
}
