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

const AUTH_URL = 'https://oauth.pipedrive.com/oauth/authorize';
const TOKEN_URL = 'https://oauth.pipedrive.com/oauth/token';
const DEFAULT_API_HOST = 'https://api.pipedrive.com';
const SCOPES = ['contacts:read', 'contacts:full'];

/**
 * Pipedrive returns a company-specific `api_domain` with the token (e.g.
 * https://acme.pipedrive.com). Calls work against the generic host too, but
 * the per-company domain is what Pipedrive documents, so we store it in
 * portalId and fall back to the generic host for older connections.
 */
@Injectable()
export class PipedriveProvider implements CrmProviderAdapter {
  readonly key = 'pipedrive';
  readonly label = 'Pipedrive';
  readonly scopes = SCOPES;
  readonly authKind = 'oauth' as const;
  readonly docsUrl = 'https://pipedrive.readme.io/docs/marketplace-oauth-authorization';
  readonly setupSteps = [
    'You will be sent to Pipedrive to sign in.',
    'Approve access for your company, and you are returned here connected.',
  ];

  isConfigured() {
    return Boolean(this.clientId() && this.clientSecret() && this.redirectUri());
  }

  buildAuthUrl(state: string) {
    if (!this.isConfigured()) {
      throw new CrmApiError(
        400,
        'Pipedrive OAuth environment variables are not configured',
      );
    }
    const params = new URLSearchParams({
      client_id: this.clientId(),
      redirect_uri: this.redirectUri(),
      state,
    });
    return `${AUTH_URL}?${params.toString()}`;
  }

  async exchangeCode(code: string): Promise<CrmTokenResponse> {
    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${this.basicAuth()}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        redirect_uri: this.redirectUri(),
        code,
      }),
    });

    if (!response.ok) {
      throw await this.toApiError(response, 'Pipedrive token exchange failed');
    }

    return response.json();
  }

  async refreshToken(refreshToken: string): Promise<CrmTokenResponse> {
    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${this.basicAuth()}`,
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      throw await this.toApiError(response, 'Pipedrive token refresh failed');
    }

    return response.json();
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
    const url = new URL(`${this.host(apiDomain)}/api/v1/persons`);
    url.searchParams.set('limit', '100');

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      throw await this.toApiError(
        response,
        `Pipedrive contact import failed: ${response.status}`,
      );
    }

    const payload = (await response.json()) as {
      data?: Array<{
        name?: string | null;
        first_name?: string | null;
        last_name?: string | null;
        email?: Array<{ value?: string | null; primary?: boolean }> | null;
        org_id?: { name?: string | null } | null;
      }> | null;
    };

    return (payload.data || []).map((person) => ({
      email: this.primaryEmail(person.email),
      firstName: this.clean(person.first_name),
      lastName: this.clean(person.last_name),
      company: this.clean(person.org_id?.name),
      status: 'new',
    }));
  }

  /**
   * Pipedrive has no upsert endpoint, so search by email first and PUT when
   * the person already exists.
   */
  async upsertContact(
    accessToken: string,
    apiDomain: string | null,
    contact: CrmContactInput,
  ): Promise<CrmContactUpsertResult> {
    const host = this.host(apiDomain);
    const existingId = await this.findPersonIdByEmail(
      accessToken,
      host,
      contact.email,
    );

    const body: Record<string, unknown> = {
      name: contact.name || contact.companyName || contact.email,
      email: [{ value: contact.email, primary: true }],
    };

    const response = await fetch(
      existingId
        ? `${host}/api/v1/persons/${existingId}`
        : `${host}/api/v1/persons`,
      {
        method: existingId ? 'PUT' : 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      },
    );

    if (!response.ok) {
      throw await this.toApiError(response, 'Pipedrive contact sync failed');
    }

    const payload = (await response.json()) as { data?: { id?: number } };
    const id = payload.data?.id;
    if (!id) {
      throw new CrmApiError(502, 'Pipedrive did not return a person id');
    }

    const noteBody = this.buildNote(contact);
    if (noteBody) {
      await this.addNote(accessToken, host, id, noteBody);
    }

    return { externalId: String(id), created: !existingId };
  }

  private async findPersonIdByEmail(
    accessToken: string,
    host: string,
    email: string,
  ): Promise<number | null> {
    const url = new URL(`${host}/api/v1/persons/search`);
    url.searchParams.set('term', email);
    url.searchParams.set('fields', 'email');
    url.searchParams.set('exact_match', 'true');
    url.searchParams.set('limit', '1');

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      throw await this.toApiError(response, 'Pipedrive contact lookup failed');
    }

    const payload = (await response.json()) as {
      data?: { items?: Array<{ item?: { id?: number } }> } | null;
    };
    return payload.data?.items?.[0]?.item?.id ?? null;
  }

  private buildNote(contact: CrmContactInput): string | null {
    const lines: string[] = [];
    if (contact.companyName) lines.push(`Company: ${contact.companyName}`);
    if (contact.website) lines.push(`Website: ${contact.website}`);
    if (contact.jobTitle) lines.push(`Title: ${contact.jobTitle}`);
    if (contact.linkedinUrl) lines.push(`LinkedIn: ${contact.linkedinUrl}`);
    if (contact.note) lines.push(contact.note);
    if (lines.length === 0) return null;
    return ['Synced from AegisLead Prospect Search.', ...lines].join('\n');
  }

  private async addNote(
    accessToken: string,
    host: string,
    personId: number,
    content: string,
  ) {
    const response = await fetch(`${host}/api/v1/notes`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ person_id: personId, content }),
    });

    if (!response.ok) {
      // The person was created/updated fine - a failed note shouldn't fail
      // the whole sync, so skip it silently (same rule as the GHL adapter).
      return;
    }
  }

  private primaryEmail(
    emails?: Array<{ value?: string | null; primary?: boolean }> | null,
  ) {
    if (!emails || emails.length === 0) return null;
    const primary = emails.find((entry) => entry.primary) || emails[0];
    return this.clean(primary?.value);
  }

  private host(apiDomain?: string | null) {
    const base = apiDomain || DEFAULT_API_HOST;
    return base.replace(/\/+$/, '');
  }

  private basicAuth() {
    return Buffer.from(`${this.clientId()}:${this.clientSecret()}`).toString(
      'base64',
    );
  }

  private async toApiError(response: Response, fallback: string) {
    let message = fallback;
    try {
      const body = (await response.json()) as {
        error?: string;
        error_info?: string;
      };
      if (body.error) {
        message = body.error_info ? `${body.error}: ${body.error_info}` : body.error;
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
    return process.env.PIPEDRIVE_CLIENT_ID || '';
  }

  private clientSecret() {
    return process.env.PIPEDRIVE_CLIENT_SECRET || '';
  }

  private redirectUri() {
    return process.env.PIPEDRIVE_REDIRECT_URI || '';
  }
}
