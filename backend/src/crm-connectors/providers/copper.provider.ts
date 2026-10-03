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

const API_BASE = 'https://api.copper.com/developer_api/v1';

/**
 * Copper authenticates with an API key *plus* the email of the user who
 * generated it - both go on every request. We store them together in the
 * token column as "<email>:<key>", since the connection row has one secret
 * field and both halves are equally sensitive.
 */
@Injectable()
export class CopperProvider implements CrmProviderAdapter {
  readonly key = 'copper';
  readonly label = 'Copper';
  readonly scopes: string[] = [];
  readonly authKind = 'api_key' as const;
  readonly docsUrl = 'https://developer.copper.com/introduction/authentication.html';
  readonly setupSteps = [
    'In Copper, open Settings > Integrations > API Keys.',
    'Generate a key and copy it.',
    'Enter it below with the email of the user it belongs to - Copper needs both.',
  ];
  readonly credentialFields: CrmCredentialField[] = [
    {
      key: 'email',
      label: 'Copper account email',
      placeholder: 'you@company.com',
      helpText: 'The user the API key belongs to',
    },
    {
      key: 'apiKey',
      label: 'API key',
      helpText: 'Copper > Settings > Integrations > API Keys',
    },
  ];

  /** No operator-side setup: every tenant connects with their own key. */
  isConfigured() {
    return true;
  }

  buildAuthUrl(): string {
    throw new CrmApiError(400, 'Copper connects with an API key, not OAuth');
  }

  exchangeCode(): Promise<CrmTokenResponse> {
    throw new CrmApiError(400, 'Copper connects with an API key, not OAuth');
  }

  refreshToken(): Promise<CrmTokenResponse> {
    throw new CrmApiError(
      400,
      'Copper API keys do not expire and cannot be refreshed',
    );
  }

  extractAccountMeta(): CrmAccountMeta {
    return { portalId: null, externalAccountName: null };
  }

  async verifyCredentials(credentials: Record<string, string>) {
    const email = (credentials.email || '').trim();
    const apiKey = (credentials.apiKey || '').trim();

    if (!email || !apiKey) {
      throw new CrmApiError(
        400,
        'Both the Copper account email and an API key are required',
      );
    }

    const token = this.packToken(email, apiKey);
    const response = await fetch(`${API_BASE}/account`, {
      headers: this.headers(token),
    });

    if (response.status === 401 || response.status === 403) {
      throw new CrmApiError(401, 'Copper rejected these credentials');
    }
    if (!response.ok) {
      throw await this.toApiError(
        response,
        'Could not verify these Copper credentials',
      );
    }

    const payload = (await response.json()) as { id?: number; name?: string };

    return {
      token,
      meta: {
        portalId: payload.id ? String(payload.id) : null,
        externalAccountName: payload.name || null,
      },
    };
  }

  async fetchContacts(token: string): Promise<NormalizedCrmContact[]> {
    const response = await fetch(`${API_BASE}/people/search`, {
      method: 'POST',
      headers: { ...this.headers(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ page_size: 100, page_number: 1 }),
    });

    if (!response.ok) {
      throw await this.toApiError(
        response,
        `Copper contact import failed: ${response.status}`,
      );
    }

    const payload = (await response.json()) as Array<{
      name?: string | null;
      emails?: Array<{ email?: string | null }> | null;
      company_name?: string | null;
    }>;

    return (payload || []).map((person) => {
      const { firstName, lastName } = this.splitName(person.name);
      return {
        email: this.clean(person.emails?.[0]?.email),
        firstName,
        lastName,
        company: this.clean(person.company_name),
        status: 'new',
      };
    });
  }

  /**
   * Copper has fetch_by_email, so look the person up and PUT when they
   * already exist rather than creating a duplicate.
   */
  async upsertContact(
    token: string,
    _portalId: string | null,
    contact: CrmContactInput,
  ): Promise<CrmContactUpsertResult> {
    const existingId = await this.findPersonIdByEmail(token, contact.email);

    const body: Record<string, unknown> = {
      name: contact.name || contact.email,
      emails: [{ email: contact.email, category: 'work' }],
      company_name: contact.companyName || undefined,
      title: contact.jobTitle || undefined,
      details: this.buildDetails(contact) || undefined,
      websites: contact.website
        ? [{ url: contact.website, category: 'work' }]
        : undefined,
      address:
        contact.city || contact.state || contact.country
          ? {
              city: contact.city || undefined,
              state: contact.state || undefined,
              country: contact.country || undefined,
            }
          : undefined,
    };

    const response = await fetch(
      existingId ? `${API_BASE}/people/${existingId}` : `${API_BASE}/people`,
      {
        method: existingId ? 'PUT' : 'POST',
        headers: { ...this.headers(token), 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    );

    if (!response.ok) {
      throw await this.toApiError(response, 'Copper contact sync failed');
    }

    const payload = (await response.json()) as { id?: number };
    if (!payload.id) {
      throw new CrmApiError(502, 'Copper did not return a person id');
    }

    return { externalId: String(payload.id), created: !existingId };
  }

  private async findPersonIdByEmail(token: string, email: string) {
    const response = await fetch(`${API_BASE}/people/fetch_by_email`, {
      method: 'POST',
      headers: { ...this.headers(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    // Copper answers 404 when no person has that address.
    if (response.status === 404) return null;

    if (!response.ok) {
      throw await this.toApiError(response, 'Copper contact lookup failed');
    }

    const payload = (await response.json()) as { id?: number };
    return payload.id || null;
  }

  private buildDetails(contact: CrmContactInput): string | null {
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

  private packToken(email: string, apiKey: string) {
    return `${email}:${apiKey}`;
  }

  /** The email may itself contain no colon, so split on the first one only. */
  private unpackToken(token: string) {
    const separator = token.indexOf(':');
    if (separator === -1) {
      throw new CrmApiError(400, 'Stored Copper credentials are malformed');
    }
    return {
      email: token.slice(0, separator),
      apiKey: token.slice(separator + 1),
    };
  }

  private headers(token: string) {
    const { email, apiKey } = this.unpackToken(token);
    return {
      'X-PW-AccessToken': apiKey,
      'X-PW-Application': 'developer_api',
      'X-PW-UserEmail': email,
    };
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
}
