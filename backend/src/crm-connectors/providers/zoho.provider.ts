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

const SCOPES = ['ZohoCRM.modules.contacts.ALL', 'ZohoCRM.settings.READ'];

/**
 * Zoho is multi-datacenter: an account lives in one region and its API and
 * token hosts differ per region. The region is not known until the user
 * picks it at consent time - Zoho then returns `api_domain` with the token
 * and an `accounts-server` param on the callback.
 *
 * We store api_domain in portalId (the same slot GHL/Salesforce use) and
 * derive the matching accounts host from it for refreshes, so a tenant in
 * the EU keeps talking to the EU.
 *
 * ZOHO_ACCOUNTS_HOST only sets which region the consent screen starts on;
 * the user can still switch, and we follow whatever they chose.
 */
@Injectable()
export class ZohoProvider implements CrmProviderAdapter {
  readonly key = 'zoho';
  readonly label = 'Zoho CRM';
  readonly scopes = SCOPES;
  readonly authKind = 'oauth' as const;
  readonly docsUrl = 'https://www.zoho.com/crm/developer/docs/api/v5/oauth-overview.html';
  readonly setupSteps = [
    'You will be sent to Zoho to sign in.',
    'Pick the datacenter your Zoho account lives in if prompted.',
    'Approve access, and you are returned here connected.',
  ];

  isConfigured() {
    return Boolean(this.clientId() && this.clientSecret() && this.redirectUri());
  }

  buildAuthUrl(state: string) {
    if (!this.isConfigured()) {
      throw new CrmApiError(
        400,
        'Zoho OAuth environment variables are not configured',
      );
    }
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId(),
      redirect_uri: this.redirectUri(),
      scope: SCOPES.join(','),
      // Zoho only returns a refresh token when both are set.
      access_type: 'offline',
      prompt: 'consent',
      state,
    });
    return `${this.defaultAccountsHost()}/oauth/v2/auth?${params.toString()}`;
  }

  async exchangeCode(code: string): Promise<CrmTokenResponse> {
    const response = await fetch(
      `${this.defaultAccountsHost()}/oauth/v2/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: this.clientId(),
          client_secret: this.clientSecret(),
          redirect_uri: this.redirectUri(),
          code,
        }),
      },
    );

    const token = await this.readToken(response, 'Zoho token exchange failed');
    if (!token.access_token) {
      throw new CrmApiError(400, 'Zoho token exchange returned no access token');
    }
    return token;
  }

  async refreshToken(refreshToken: string): Promise<CrmTokenResponse> {
    const response = await fetch(
      `${this.defaultAccountsHost()}/oauth/v2/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: this.clientId(),
          client_secret: this.clientSecret(),
          refresh_token: refreshToken,
        }),
      },
    );

    const token = await this.readToken(response, 'Zoho token refresh failed');
    if (!token.access_token) {
      throw new CrmApiError(400, 'Zoho token refresh returned no access token');
    }
    // Zoho omits the refresh token on refresh - it stays valid until revoked,
    // and the service keeps the stored one when this is undefined.
    return token;
  }

  extractAccountMeta(token: CrmTokenResponse): CrmAccountMeta {
    const apiDomain = (token.api_domain as string) || null;
    return {
      portalId: apiDomain,
      externalAccountName: apiDomain
        ? apiDomain.replace(/^https?:\/\//, '')
        : null,
    };
  }

  async fetchContacts(
    accessToken: string,
    apiDomain?: string | null,
  ): Promise<NormalizedCrmContact[]> {
    const url = new URL(`${this.host(apiDomain)}/crm/v5/Contacts`);
    url.searchParams.set('fields', 'First_Name,Last_Name,Email,Account_Name');
    url.searchParams.set('per_page', '200');

    const response = await fetch(url, {
      headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
    });

    // Zoho answers 204 with an empty body when the module has no records.
    if (response.status === 204) return [];

    if (!response.ok) {
      throw await this.toApiError(
        response,
        `Zoho contact import failed: ${response.status}`,
      );
    }

    const payload = (await response.json()) as {
      data?: Array<{
        First_Name?: string | null;
        Last_Name?: string | null;
        Email?: string | null;
        Account_Name?: { name?: string | null } | null;
      }> | null;
    };

    return (payload.data || []).map((record) => ({
      email: this.clean(record.Email),
      firstName: this.clean(record.First_Name),
      lastName: this.clean(record.Last_Name),
      company: this.clean(record.Account_Name?.name),
      status: 'new',
    }));
  }

  /**
   * Zoho has a native upsert that dedupes on Email, so one call does both
   * create and update - no lookup needed.
   */
  async upsertContact(
    accessToken: string,
    apiDomain: string | null,
    contact: CrmContactInput,
  ): Promise<CrmContactUpsertResult> {
    const { firstName, lastName } = this.splitName(contact);
    const record: Record<string, unknown> = {
      Last_Name: lastName || 'Unknown',
      First_Name: firstName || undefined,
      Email: contact.email,
      Title: contact.jobTitle || undefined,
      Mailing_City: contact.city || undefined,
      Mailing_State: contact.state || undefined,
      Mailing_Country: contact.country || undefined,
      Description: this.buildDescription(contact) || undefined,
      Lead_Source: 'AegisLead Prospect Search',
    };

    const response = await fetch(`${this.host(apiDomain)}/crm/v5/Contacts/upsert`, {
      method: 'POST',
      headers: {
        Authorization: `Zoho-oauthtoken ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        data: [record],
        duplicate_check_fields: ['Email'],
      }),
    });

    if (!response.ok) {
      throw await this.toApiError(response, 'Zoho contact sync failed');
    }

    const payload = (await response.json()) as {
      data?: Array<{
        code?: string;
        action?: string;
        message?: string;
        details?: { id?: string };
      }>;
    };

    const result = payload.data?.[0];
    if (!result?.details?.id) {
      throw new CrmApiError(
        502,
        result?.message || 'Zoho did not return a contact id',
      );
    }

    return {
      externalId: result.details.id,
      created: result.action !== 'update',
    };
  }

  /** Zoho requires Last_Name on a Contact, so always derive one. */
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

  /**
   * Zoho reports OAuth failures as HTTP 200 with an `error` field, so a
   * plain response.ok check is not enough here.
   */
  private async readToken(
    response: Response,
    fallback: string,
  ): Promise<CrmTokenResponse> {
    if (!response.ok) {
      throw await this.toApiError(response, fallback);
    }

    const token = (await response.json()) as CrmTokenResponse & {
      error?: string;
    };
    if (token.error) {
      throw new CrmApiError(400, `${fallback}: ${token.error}`);
    }
    return token;
  }

  private host(apiDomain?: string | null) {
    if (!apiDomain) {
      throw new CrmApiError(400, 'Missing Zoho API domain for this connection');
    }
    return apiDomain.replace(/\/+$/, '');
  }

  private defaultAccountsHost() {
    return (
      process.env.ZOHO_ACCOUNTS_HOST?.replace(/\/+$/, '') ||
      'https://accounts.zoho.com'
    );
  }

  private async toApiError(response: Response, fallback: string) {
    let message = fallback;
    try {
      const body = (await response.json()) as {
        message?: string;
        error?: string;
      };
      if (body.message) {
        message = body.message;
      } else if (body.error) {
        message = body.error;
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
    return process.env.ZOHO_CLIENT_ID || '';
  }

  private clientSecret() {
    return process.env.ZOHO_CLIENT_SECRET || '';
  }

  private redirectUri() {
    return process.env.ZOHO_REDIRECT_URI || '';
  }
}
