import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHmac, createHash, randomBytes } from 'crypto';
import { AuditService } from '../audit/audit.service';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { PrismaService } from '../prisma/prisma.service';

const HUBSPOT_PROVIDER = 'hubspot';
const HUBSPOT_AUTH_URL = 'https://app.hubspot.com/oauth/authorize';
const HUBSPOT_TOKEN_URL = 'https://api.hubapi.com/oauth/v1/token';
const HUBSPOT_CONTACTS_URL = 'https://api.hubapi.com/crm/v3/objects/contacts';
const HUBSPOT_SCOPES = ['crm.objects.contacts.read'];

@Injectable()
export class CrmConnectorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async getStatus(user: ActiveUser) {
    const connection = await this.prisma.crmConnection.findUnique({
      where: {
        tenantId_provider: {
          tenantId: user.tenantId,
          provider: HUBSPOT_PROVIDER,
        },
      },
    });

    return {
      hubspot: {
        configured: this.isHubSpotConfigured(),
        connected: connection?.status === 'connected',
        status: connection?.status || 'not_connected',
        portal_id: connection?.portalId || null,
        external_account_name: connection?.externalAccountName || null,
        scopes: connection?.scopes || HUBSPOT_SCOPES,
        token_expires_at: connection?.tokenExpiresAt || null,
        last_sync_at: connection?.lastSyncAt || null,
        last_error: connection?.lastError || null,
      },
    };
  }

  getHubSpotConnectUrl(user: ActiveUser) {
    this.assertHubSpotConfigured();

    const params = new URLSearchParams({
      client_id: this.hubSpotClientId(),
      redirect_uri: this.hubSpotRedirectUri(),
      scope: HUBSPOT_SCOPES.join(' '),
      state: this.signState({
        tenantId: user.tenantId,
        userId: user.sub,
        nonce: randomBytes(12).toString('base64url'),
        createdAt: Date.now(),
      }),
    });

    return {
      provider: HUBSPOT_PROVIDER,
      url: `${HUBSPOT_AUTH_URL}?${params.toString()}`,
    };
  }

  async handleHubSpotCallback(code: string | undefined, state: string | undefined) {
    this.assertHubSpotConfigured();
    if (!code) throw new BadRequestException('Missing HubSpot authorization code');
    const parsedState = this.verifyState(state);

    const token = await this.exchangeCode(code);
    const accessToken = this.encrypt(token.access_token);
    const refreshToken = token.refresh_token ? this.encrypt(token.refresh_token) : null;
    const expiresAt = token.expires_in
      ? new Date(Date.now() + Number(token.expires_in) * 1000)
      : null;

    const connection = await this.prisma.crmConnection.upsert({
      where: {
        tenantId_provider: {
          tenantId: parsedState.tenantId,
          provider: HUBSPOT_PROVIDER,
        },
      },
      update: {
        status: 'connected',
        accessToken,
        refreshToken,
        tokenExpiresAt: expiresAt,
        scopes: this.scopeList(token.scope),
        portalId: token.hub_id ? String(token.hub_id) : undefined,
        externalAccountName: token.hub_domain || null,
        lastError: null,
      },
      create: {
        tenantId: parsedState.tenantId,
        provider: HUBSPOT_PROVIDER,
        status: 'connected',
        accessToken,
        refreshToken,
        tokenExpiresAt: expiresAt,
        scopes: this.scopeList(token.scope),
        portalId: token.hub_id ? String(token.hub_id) : null,
        externalAccountName: token.hub_domain || null,
      },
    });

    await this.auditService.log({
      tenantId: parsedState.tenantId,
      userId: parsedState.userId,
      action: 'CRM_CONNECTED',
      entityType: 'CrmConnection',
      entityId: connection.id,
      details: 'HubSpot connected',
    });

    return connection;
  }

  async disconnectHubSpot(user: ActiveUser) {
    const connection = await this.prisma.crmConnection.findUnique({
      where: {
        tenantId_provider: {
          tenantId: user.tenantId,
          provider: HUBSPOT_PROVIDER,
        },
      },
    });

    if (!connection) throw new NotFoundException('HubSpot is not connected');

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
      details: 'HubSpot disconnected',
    });

    return this.serializeConnection(updated);
  }

  async importHubSpotContacts(user: ActiveUser) {
    const connection = await this.activeHubSpotConnection(user.tenantId);
    const token = await this.validAccessToken(connection);
    const url = new URL(HUBSPOT_CONTACTS_URL);
    url.searchParams.set('limit', '100');
    url.searchParams.set('properties', 'firstname,lastname,email,company,hs_lead_status');

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      const message = await response.text();
      await this.recordSyncError(connection.id, message || `HubSpot import failed: ${response.status}`);
      throw new BadRequestException('HubSpot contact import failed');
    }

    const payload = await response.json() as {
      results?: Array<{ id: string; properties?: Record<string, string | null> }>;
    };
    const contacts = payload.results || [];
    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const contact of contacts) {
      const properties = contact.properties || {};
      const email = this.clean(properties.email);
      const firstName = this.clean(properties.firstname);
      const lastName = this.clean(properties.lastname);
      const name = [firstName, lastName].filter(Boolean).join(' ') || email || 'HubSpot Contact';
      const company = this.clean(properties.company) || 'HubSpot Contact';
      const status = this.clean(properties.hs_lead_status)?.toLowerCase() || 'new';

      if (!email && !name) {
        skipped += 1;
        continue;
      }

      const existing = await this.prisma.lead.findFirst({
        where: {
          tenantId: user.tenantId,
          OR: email ? [{ email }, { name, company }] : [{ name, company }],
        },
      });

      if (existing) {
        await this.prisma.lead.update({
          where: { id: existing.id },
          data: { name, company, ...(email ? { email } : {}), status },
        });
        updated += 1;
      } else {
        await this.prisma.lead.create({
          data: {
            tenantId: user.tenantId,
            name,
            company,
            email,
            status,
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
      details: `Imported HubSpot contacts: ${created} created, ${updated} updated`,
    });

    return {
      provider: HUBSPOT_PROVIDER,
      total: contacts.length,
      created,
      updated,
      skipped,
    };
  }

  private async activeHubSpotConnection(tenantId: string) {
    const connection = await this.prisma.crmConnection.findUnique({
      where: {
        tenantId_provider: {
          tenantId,
          provider: HUBSPOT_PROVIDER,
        },
      },
    });

    if (!connection || connection.status !== 'connected' || !connection.accessToken) {
      throw new BadRequestException('HubSpot is not connected');
    }

    return connection;
  }

  private async validAccessToken(connection: any) {
    if (
      connection.tokenExpiresAt &&
      connection.tokenExpiresAt.getTime() < Date.now() + 2 * 60 * 1000 &&
      connection.refreshToken
    ) {
      const refreshed = await this.refreshToken(this.decrypt(connection.refreshToken));
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
          scopes: this.scopeList(refreshed.scope),
        },
      });
      return refreshed.access_token;
    }

    return this.decrypt(connection.accessToken);
  }

  private async exchangeCode(code: string) {
    const response = await fetch(HUBSPOT_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: this.hubSpotClientId(),
        client_secret: this.hubSpotClientSecret(),
        redirect_uri: this.hubSpotRedirectUri(),
        code,
      }),
    });

    if (!response.ok) {
      throw new BadRequestException('HubSpot token exchange failed');
    }

    return response.json() as Promise<any>;
  }

  private async refreshToken(refreshToken: string) {
    const response = await fetch(HUBSPOT_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: this.hubSpotClientId(),
        client_secret: this.hubSpotClientSecret(),
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      throw new BadRequestException('HubSpot token refresh failed');
    }

    return response.json() as Promise<any>;
  }

  private async recordSyncError(connectionId: string, message: string) {
    await this.prisma.crmConnection.update({
      where: { id: connectionId },
      data: { lastError: message.slice(0, 500) },
    });
  }

  private serializeConnection(connection: any) {
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

  private isHubSpotConfigured() {
    return Boolean(this.hubSpotClientId() && this.hubSpotClientSecret() && this.hubSpotRedirectUri());
  }

  private assertHubSpotConfigured() {
    if (!this.isHubSpotConfigured()) {
      throw new BadRequestException('HubSpot OAuth environment variables are not configured');
    }
  }

  private hubSpotClientId() {
    return process.env.HUBSPOT_CLIENT_ID || '';
  }

  private hubSpotClientSecret() {
    return process.env.HUBSPOT_CLIENT_SECRET || '';
  }

  private hubSpotRedirectUri() {
    return process.env.HUBSPOT_REDIRECT_URI || '';
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
    return process.env.CRM_TOKEN_SECRET || process.env.JWT_ACCESS_SECRET || 'local-crm-token-secret';
  }

  private scopeList(scope?: string) {
    return scope ? scope.split(/\s+/).filter(Boolean) : HUBSPOT_SCOPES;
  }

  private clean(value?: string | null) {
    const trimmed = value?.trim();
    return trimmed || null;
  }

  hubSpotResultUrl(success: boolean) {
    const params = new URLSearchParams({ crm: success ? 'hubspot_connected' : 'hubspot_failed' });
    return `${this.frontendUrl()}/integrations?${params.toString()}`;
  }
}
