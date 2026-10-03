import { Injectable } from '@nestjs/common';
import {
  CrmAccountMeta,
  CrmApiError,
  CrmContactInput,
  CrmContactUpsertResult,
  CrmProviderAdapter,
  CrmTokenResponse,
  NormalizedCrmContact,
} from './crm-provider.interface';

const AUTH_URL = 'https://login.salesforce.com/services/oauth2/authorize';
const TOKEN_URL = 'https://login.salesforce.com/services/oauth2/token';
const API_VERSION = 'v59.0';
const SCOPES = ['api', 'refresh_token'];

/**
 * Salesforce hands back a per-org `instance_url` at token time and every
 * later API call must go to that host, not to login.salesforce.com. We keep
 * it in the connection's portalId column (the same slot GHL uses for its
 * location id) so no schema change is needed.
 */
@Injectable()
export class SalesforceProvider implements CrmProviderAdapter {
  readonly key = 'salesforce';
  readonly label = 'Salesforce';
  readonly scopes = SCOPES;
  readonly authKind = 'oauth' as const;
  readonly docsUrl =
    'https://help.salesforce.com/s/articleView?id=sf.connected_app_create.htm';
  readonly setupSteps = [
    'You will be sent to Salesforce to sign in.',
    'Approve access for your org, and you are returned here connected.',
  ];

  isConfigured() {
    return Boolean(this.clientId() && this.clientSecret() && this.redirectUri());
  }

  buildAuthUrl(state: string) {
    if (!this.isConfigured()) {
      throw new CrmApiError(
        400,
        'Salesforce OAuth environment variables are not configured',
      );
    }
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId(),
      redirect_uri: this.redirectUri(),
      scope: SCOPES.join(' '),
      state,
    });
    return `${AUTH_URL}?${params.toString()}`;
  }

  async exchangeCode(code: string): Promise<CrmTokenResponse> {
    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: this.clientId(),
        client_secret: this.clientSecret(),
        redirect_uri: this.redirectUri(),
        code,
      }),
    });

    if (!response.ok) {
      throw await this.toApiError(response, 'Salesforce token exchange failed');
    }

    return response.json();
  }

  async refreshToken(refreshToken: string): Promise<CrmTokenResponse> {
    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: this.clientId(),
        client_secret: this.clientSecret(),
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      throw await this.toApiError(response, 'Salesforce token refresh failed');
    }

    return response.json();
  }

  extractAccountMeta(token: CrmTokenResponse): CrmAccountMeta {
    const instanceUrl = (token.instance_url as string) || null;
    return {
      portalId: instanceUrl,
      externalAccountName: instanceUrl
        ? instanceUrl.replace(/^https?:\/\//, '')
        : null,
    };
  }

  async fetchContacts(
    accessToken: string,
    instanceUrl?: string | null,
  ): Promise<NormalizedCrmContact[]> {
    const host = this.requireInstance(instanceUrl);
    const soql =
      'SELECT Id, FirstName, LastName, Email, Account.Name FROM Contact ' +
      'WHERE Email != NULL ORDER BY LastModifiedDate DESC LIMIT 200';

    const url = new URL(`${host}/services/data/${API_VERSION}/query`);
    url.searchParams.set('q', soql);

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      throw await this.toApiError(
        response,
        `Salesforce contact import failed: ${response.status}`,
      );
    }

    const payload = (await response.json()) as {
      records?: Array<{
        FirstName?: string | null;
        LastName?: string | null;
        Email?: string | null;
        Account?: { Name?: string | null } | null;
      }>;
    };

    return (payload.records || []).map((record) => ({
      email: this.clean(record.Email),
      firstName: this.clean(record.FirstName),
      lastName: this.clean(record.LastName),
      company: this.clean(record.Account?.Name),
      status: 'new',
    }));
  }

  /**
   * Salesforce has no upsert-by-email on Contact without a custom external
   * id field, so we look the contact up first and PATCH it when it exists.
   */
  async upsertContact(
    accessToken: string,
    instanceUrl: string | null,
    contact: CrmContactInput,
  ): Promise<CrmContactUpsertResult> {
    const host = this.requireInstance(instanceUrl);
    const existingId = await this.findContactIdByEmail(
      accessToken,
      host,
      contact.email,
    );

    const { firstName, lastName } = this.splitName(contact);
    const body: Record<string, unknown> = {
      FirstName: firstName || undefined,
      LastName: lastName || 'Unknown',
      Email: contact.email,
      Title: contact.jobTitle || undefined,
      MailingCity: contact.city || undefined,
      MailingState: contact.state || undefined,
      MailingCountry: contact.country || undefined,
      Description: this.buildDescription(contact) || undefined,
    };

    const base = `${host}/services/data/${API_VERSION}/sobjects/Contact`;
    const response = await fetch(existingId ? `${base}/${existingId}` : base, {
      method: existingId ? 'PATCH' : 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw await this.toApiError(response, 'Salesforce contact sync failed');
    }

    if (existingId) {
      // A successful PATCH returns 204 with no body.
      return { externalId: existingId, created: false };
    }

    const payload = (await response.json()) as { id?: string };
    if (!payload.id) {
      throw new CrmApiError(502, 'Salesforce did not return a contact id');
    }
    return { externalId: payload.id, created: true };
  }

  private async findContactIdByEmail(
    accessToken: string,
    host: string,
    email: string,
  ): Promise<string | null> {
    const url = new URL(`${host}/services/data/${API_VERSION}/query`);
    url.searchParams.set(
      'q',
      `SELECT Id FROM Contact WHERE Email = '${this.escapeSoql(email)}' LIMIT 1`,
    );

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      throw await this.toApiError(response, 'Salesforce contact lookup failed');
    }

    const payload = (await response.json()) as {
      records?: Array<{ Id?: string }>;
    };
    return payload.records?.[0]?.Id || null;
  }

  /** Contact.LastName is required by Salesforce, so always derive one. */
  private splitName(contact: CrmContactInput) {
    if (contact.firstName || contact.lastName) {
      return {
        firstName: this.clean(contact.firstName),
        lastName: this.clean(contact.lastName),
      };
    }
    const parts = (contact.name || '').trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return { firstName: null, lastName: null };
    if (parts.length === 1) return { firstName: null, lastName: parts[0] };
    return {
      firstName: parts.slice(0, -1).join(' '),
      lastName: parts[parts.length - 1],
    };
  }

  private buildDescription(contact: CrmContactInput): string | null {
    const lines: string[] = [];
    if (contact.companyName) lines.push(`Company: ${contact.companyName}`);
    if (contact.website) lines.push(`Website: ${contact.website}`);
    if (contact.linkedinUrl) lines.push(`LinkedIn: ${contact.linkedinUrl}`);
    if (contact.note) lines.push(contact.note);
    if (lines.length === 0) return null;
    return ['Synced from AegisLead Prospect Search.', ...lines].join('\n');
  }

  private requireInstance(instanceUrl?: string | null) {
    if (!instanceUrl) {
      throw new CrmApiError(400, 'Missing Salesforce instance for this connection');
    }
    return instanceUrl.replace(/\/+$/, '');
  }

  /** SOQL string literals escape backslashes and single quotes. */
  private escapeSoql(value: string) {
    return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  }

  private async toApiError(response: Response, fallback: string) {
    let message = fallback;
    try {
      // Salesforce errors come back as [{ message, errorCode }].
      const body = (await response.json()) as
        | Array<{ message?: string }>
        | { error_description?: string };
      if (Array.isArray(body)) {
        const joined = body
          .map((entry) => entry.message)
          .filter(Boolean)
          .join('; ');
        if (joined) message = joined;
      } else if (body.error_description) {
        message = body.error_description;
      }
    } catch {
      // Non-JSON error body - fall back to the generic message.
    }
    return new CrmApiError(response.status, message.slice(0, 500));
  }

  private clean(value?: string | null) {
    const trimmed = value?.trim();
    return trimmed || null;
  }

  private clientId() {
    return process.env.SALESFORCE_CLIENT_ID || '';
  }

  private clientSecret() {
    return process.env.SALESFORCE_CLIENT_SECRET || '';
  }

  private redirectUri() {
    return process.env.SALESFORCE_REDIRECT_URI || '';
  }
}
