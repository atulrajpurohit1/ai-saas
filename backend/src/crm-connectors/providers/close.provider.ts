import { Injectable } from '@nestjs/common';
import {
  CrmAccountMeta,
  CrmApiError,
  CrmContactInput,
  CrmContactUpsertResult,
  CrmCredentialField,
  CrmProviderAdapter,
  CrmTokenResponse,
  NormalizedCrmContact,
} from './crm-provider.interface';

const API_BASE = 'https://api.close.com/api/v1';

/**
 * Close authenticates with an API key the user generates in Close under
 * Settings > API Keys. There is no OAuth app to register, so unlike the
 * OAuth providers this one is available to every tenant out of the box -
 * isConfigured() is always true and the OAuth methods are never called.
 *
 * Close keys are sent as HTTP Basic with the key as the username and an
 * empty password.
 */
@Injectable()
export class CloseProvider implements CrmProviderAdapter {
  readonly key = 'close';
  readonly label = 'Close';
  readonly scopes: string[] = [];
  readonly authKind = 'api_key' as const;
  readonly docsUrl = 'https://developer.close.com/topics/authentication/';
  readonly setupSteps = [
    'In Close, open Settings > API Keys.',
    'Click "New API Key" and copy the key it shows you.',
    'Paste it below - we check it against Close before saving.',
  ];
  readonly credentialFields: CrmCredentialField[] = [
    {
      key: 'apiKey',
      label: 'API key',
      placeholder: 'api_...',
      helpText: 'Close > Settings > API Keys > New API Key',
    },
  ];

  /** No operator-side setup: every tenant can connect with their own key. */
  isConfigured() {
    return true;
  }

  buildAuthUrl(): string {
    throw new CrmApiError(400, 'Close connects with an API key, not OAuth');
  }

  exchangeCode(): Promise<CrmTokenResponse> {
    throw new CrmApiError(400, 'Close connects with an API key, not OAuth');
  }

  refreshToken(): Promise<CrmTokenResponse> {
    throw new CrmApiError(400, 'Close API keys do not expire and cannot be refreshed');
  }

  extractAccountMeta(): CrmAccountMeta {
    return { portalId: null, externalAccountName: null };
  }

  async verifyCredentials(credentials: Record<string, string>) {
    const apiKey = (credentials.apiKey || '').trim();
    if (!apiKey) {
      throw new CrmApiError(400, 'An API key is required to connect Close');
    }

    const response = await fetch(`${API_BASE}/me/`, {
      headers: { Authorization: this.basic(apiKey) },
    });

    if (response.status === 401) {
      throw new CrmApiError(401, 'Close rejected this API key');
    }
    if (!response.ok) {
      throw await this.toApiError(response, 'Could not verify this Close API key');
    }

    const payload = (await response.json()) as {
      organizations?: Array<{ id?: string; name?: string }>;
    };
    const org = payload.organizations?.[0];

    return {
      token: apiKey,
      meta: {
        portalId: org?.id || null,
        externalAccountName: org?.name || null,
      },
    };
  }

  async fetchContacts(apiKey: string): Promise<NormalizedCrmContact[]> {
    const url = new URL(`${API_BASE}/contact/`);
    url.searchParams.set('_limit', '100');

    const response = await fetch(url, {
      headers: { Authorization: this.basic(apiKey) },
    });

    if (!response.ok) {
      throw await this.toApiError(
        response,
        `Close contact import failed: ${response.status}`,
      );
    }

    const payload = (await response.json()) as {
      data?: Array<{
        name?: string | null;
        title?: string | null;
        emails?: Array<{ email?: string | null }> | null;
      }> | null;
    };

    return (payload.data || []).map((contact) => {
      const { firstName, lastName } = this.splitName(contact.name);
      return {
        email: this.clean(contact.emails?.[0]?.email),
        firstName,
        lastName,
        company: null,
        status: 'new',
      };
    });
  }

  /**
   * Close models people as Contacts hanging off a Lead, so a new prospect
   * needs a Lead created first. We search by email to avoid duplicates.
   */
  async upsertContact(
    apiKey: string,
    _portalId: string | null,
    contact: CrmContactInput,
  ): Promise<CrmContactUpsertResult> {
    const existingId = await this.findContactIdByEmail(apiKey, contact.email);

    if (existingId) {
      const response = await fetch(`${API_BASE}/contact/${existingId}/`, {
        method: 'PUT',
        headers: {
          Authorization: this.basic(apiKey),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: contact.name || undefined,
          title: contact.jobTitle || undefined,
        }),
      });

      if (!response.ok) {
        throw await this.toApiError(response, 'Close contact sync failed');
      }
      return { externalId: existingId, created: false };
    }

    const response = await fetch(`${API_BASE}/lead/`, {
      method: 'POST',
      headers: {
        Authorization: this.basic(apiKey),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: contact.companyName || contact.name || contact.email,
        url: contact.website || undefined,
        description: this.buildDescription(contact) || undefined,
        addresses: this.buildAddress(contact),
        contacts: [
          {
            name: contact.name || undefined,
            title: contact.jobTitle || undefined,
            emails: [{ type: 'office', email: contact.email }],
          },
        ],
      }),
    });

    if (!response.ok) {
      throw await this.toApiError(response, 'Close contact sync failed');
    }

    const payload = (await response.json()) as {
      contacts?: Array<{ id?: string }>;
    };
    const createdId = payload.contacts?.[0]?.id;
    if (!createdId) {
      throw new CrmApiError(502, 'Close did not return a contact id');
    }

    return { externalId: createdId, created: true };
  }

  private async findContactIdByEmail(apiKey: string, email: string) {
    const url = new URL(`${API_BASE}/contact/`);
    url.searchParams.set('query', `email:"${email}"`);
    url.searchParams.set('_limit', '1');

    const response = await fetch(url, {
      headers: { Authorization: this.basic(apiKey) },
    });

    if (!response.ok) {
      throw await this.toApiError(response, 'Close contact lookup failed');
    }

    const payload = (await response.json()) as {
      data?: Array<{ id?: string }> | null;
    };
    return payload.data?.[0]?.id || null;
  }

  private buildAddress(contact: CrmContactInput) {
    if (!contact.city && !contact.state && !contact.country) return undefined;
    return [
      {
        label: 'business',
        city: contact.city || undefined,
        state: contact.state || undefined,
        country: contact.country || undefined,
      },
    ];
  }

  private buildDescription(contact: CrmContactInput): string | null {
    const lines: string[] = [];
    if (contact.linkedinUrl) lines.push(`LinkedIn: ${contact.linkedinUrl}`);
    if (contact.note) lines.push(contact.note);
    if (lines.length === 0) return null;
    return ['Synced from AegisLead Prospect Search.', ...lines].join('\n');
  }

  private splitName(name?: string | null) {
    const parts = (name || '').trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return { firstName: null, lastName: null };
    if (parts.length === 1) return { firstName: parts[0], lastName: null };
    return {
      firstName: parts.slice(0, -1).join(' '),
      lastName: parts[parts.length - 1],
    };
  }

  private basic(apiKey: string) {
    return `Basic ${Buffer.from(`${apiKey}:`).toString('base64')}`;
  }

  private async toApiError(response: Response, fallback: string) {
    let message = fallback;
    try {
      const body = (await response.json()) as {
        error?: string;
        'field-errors'?: Record<string, unknown>;
      };
      if (typeof body.error === 'string' && body.error) {
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
}
