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

const AUTH_URL = 'https://marketplace.gohighlevel.com/v2/oauth/chooselocation';
const TOKEN_URL = 'https://services.leadconnectorhq.com/oauth/token';
const CONTACTS_URL = 'https://services.leadconnectorhq.com/contacts/';
const UPSERT_CONTACT_URL = 'https://services.leadconnectorhq.com/contacts/upsert';
const API_VERSION = '2021-07-28';
const SCOPES = ['contacts.readonly', 'contacts.write'];

@Injectable()
export class GhlProvider implements CrmProviderAdapter {
  readonly key = 'ghl';
  readonly label = 'GoHighLevel';
  readonly scopes = SCOPES;

  isConfigured() {
    return Boolean(this.clientId() && this.clientSecret() && this.redirectUri());
  }

  buildAuthUrl(state: string) {
    if (!this.isConfigured()) {
      throw new CrmApiError(400, 'GHL OAuth environment variables are not configured');
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
        user_type: 'Location',
        code,
      }),
    });

    if (!response.ok) {
      throw await this.toApiError(response, 'GHL token exchange failed');
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
        user_type: 'Location',
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      throw await this.toApiError(response, 'GHL token refresh failed');
    }

    return response.json();
  }

  extractAccountMeta(token: CrmTokenResponse): CrmAccountMeta {
    const locationId = (token.locationId as string) || null;
    return {
      portalId: locationId,
      externalAccountName: null,
    };
  }

  async fetchContacts(
    accessToken: string,
    locationId?: string | null,
  ): Promise<NormalizedCrmContact[]> {
    if (!locationId) {
      throw new CrmApiError(400, 'Missing GHL location for this connection');
    }

    const url = new URL(CONTACTS_URL);
    url.searchParams.set('locationId', locationId);
    url.searchParams.set('limit', '100');

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Version: API_VERSION,
      },
    });

    if (!response.ok) {
      throw await this.toApiError(response, `GHL contact import failed: ${response.status}`);
    }

    const payload = (await response.json()) as {
      contacts?: Array<{
        email?: string | null;
        firstName?: string | null;
        lastName?: string | null;
        companyName?: string | null;
        tags?: string[];
      }>;
    };

    return (payload.contacts || []).map((contact) => ({
      email: this.clean(contact.email),
      firstName: this.clean(contact.firstName),
      lastName: this.clean(contact.lastName),
      company: this.clean(contact.companyName),
      status: 'new',
    }));
  }

  async upsertContact(
    accessToken: string,
    locationId: string | null,
    contact: CrmContactInput,
  ): Promise<CrmContactUpsertResult> {
    if (!locationId) {
      throw new CrmApiError(400, 'Missing GHL location for this connection');
    }

    const body: Record<string, unknown> = {
      locationId,
      email: contact.email,
      name: contact.name || undefined,
      companyName: contact.companyName || undefined,
      website: contact.website || undefined,
      city: contact.city || undefined,
      state: contact.state || undefined,
      country: contact.country || undefined,
      source: 'AegisLead Prospect Search',
      tags: ['aegislead-prospect-search'],
    };

    const response = await fetch(UPSERT_CONTACT_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Version: API_VERSION,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw await this.toApiError(response, 'GHL contact sync failed');
    }

    const payload = (await response.json()) as {
      new?: boolean;
      contact?: { id: string };
    };

    if (!payload.contact?.id) {
      throw new CrmApiError(502, 'GHL did not return a contact id');
    }

    const noteBody = this.buildNote(contact);
    if (noteBody) {
      await this.addNote(accessToken, payload.contact.id, noteBody);
    }

    return { externalId: payload.contact.id, created: Boolean(payload.new) };
  }

  private buildNote(contact: CrmContactInput): string | null {
    const lines: string[] = [];
    if (contact.jobTitle) lines.push(`Title: ${contact.jobTitle}`);
    if (contact.linkedinUrl) lines.push(`LinkedIn: ${contact.linkedinUrl}`);
    if (contact.note) lines.push(contact.note);
    if (lines.length === 0) return null;
    return ['Synced from AegisLead Prospect Search.', ...lines].join('\n');
  }

  private async addNote(accessToken: string, contactId: string, body: string) {
    const response = await fetch(
      `https://services.leadconnectorhq.com/contacts/${contactId}/notes`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Version: API_VERSION,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ body }),
      },
    );

    if (!response.ok) {
      // The contact was already created/updated successfully - a failed note
      // attachment shouldn't fail the whole sync, just skip it silently.
      return;
    }
  }

  private async toApiError(response: Response, fallback: string) {
    let message = fallback;
    try {
      const body = (await response.json()) as {
        message?: string | string[];
      };
      if (Array.isArray(body.message)) {
        message = body.message.join('; ');
      } else if (typeof body.message === 'string') {
        message = body.message;
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
    return process.env.GHL_CLIENT_ID || '';
  }

  private clientSecret() {
    return process.env.GHL_CLIENT_SECRET || '';
  }

  private redirectUri() {
    return process.env.GHL_REDIRECT_URI || '';
  }
}
