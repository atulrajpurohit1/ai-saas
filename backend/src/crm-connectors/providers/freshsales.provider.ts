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

/**
 * Freshsales (Freshworks CRM) is per-account hosted: every customer has
 * their own bundle at <subdomain>.myfreshworks.com, so the host is part of
 * the credentials rather than a constant. We keep the resolved base URL in
 * portalId and the API key in the token column.
 *
 * Auth is an API key from Freshsales > Settings > API Settings, sent as
 * `Authorization: Token token=<key>`.
 */
@Injectable()
export class FreshsalesProvider implements CrmProviderAdapter {
  readonly key = 'freshsales';
  readonly label = 'Freshsales';
  readonly scopes: string[] = [];
  readonly authKind = 'api_key' as const;
  readonly docsUrl = 'https://developers.freshworks.com/crm/api/#authentication';
  readonly setupSteps = [
    'In Freshsales, open Settings > API Settings.',
    'Copy your API key from that page.',
    'Enter it below along with the address you sign in with.',
  ];
  readonly credentialFields: CrmCredentialField[] = [
    {
      key: 'domain',
      label: 'Account domain',
      placeholder: 'yourcompany.myfreshworks.com',
      helpText: 'The address you use to sign in to Freshsales',
    },
    {
      key: 'apiKey',
      label: 'API key',
      helpText: 'Freshsales > Settings > API Settings',
    },
  ];

  /** No operator-side setup: every tenant connects with their own key. */
  isConfigured() {
    return true;
  }

  buildAuthUrl(): string {
    throw new CrmApiError(400, 'Freshsales connects with an API key, not OAuth');
  }

  exchangeCode(): Promise<CrmTokenResponse> {
    throw new CrmApiError(400, 'Freshsales connects with an API key, not OAuth');
  }

  refreshToken(): Promise<CrmTokenResponse> {
    throw new CrmApiError(
      400,
      'Freshsales API keys do not expire and cannot be refreshed',
    );
  }

  extractAccountMeta(): CrmAccountMeta {
    return { portalId: null, externalAccountName: null };
  }

  async verifyCredentials(credentials: Record<string, string>) {
    const apiKey = (credentials.apiKey || '').trim();
    const host = this.normalizeDomain(credentials.domain);

    if (!apiKey) {
      throw new CrmApiError(400, 'An API key is required to connect Freshsales');
    }

    const response = await fetch(`${host}/crm/sales/api/selector/owners`, {
      headers: this.headers(apiKey),
    });

    if (response.status === 401 || response.status === 403) {
      throw new CrmApiError(401, 'Freshsales rejected this API key');
    }
    if (response.status === 404) {
      throw new CrmApiError(
        400,
        'That Freshsales domain was not found - check the address you sign in with',
      );
    }
    if (!response.ok) {
      throw await this.toApiError(
        response,
        'Could not verify these Freshsales credentials',
      );
    }

    return {
      token: apiKey,
      meta: {
        portalId: host,
        externalAccountName: host.replace(/^https?:\/\//, ''),
      },
    };
  }

  async fetchContacts(
    apiKey: string,
    host?: string | null,
  ): Promise<NormalizedCrmContact[]> {
    const base = this.requireHost(host);
    const url = new URL(`${base}/crm/sales/api/contacts/view/0`);
    url.searchParams.set('per_page', '100');

    const response = await fetch(url, { headers: this.headers(apiKey) });

    if (!response.ok) {
      throw await this.toApiError(
        response,
        `Freshsales contact import failed: ${response.status}`,
      );
    }

    const payload = (await response.json()) as {
      contacts?: Array<{
        first_name?: string | null;
        last_name?: string | null;
        email?: string | null;
        sales_account?: { name?: string | null } | null;
      }> | null;
    };

    return (payload.contacts || []).map((contact) => ({
      email: this.clean(contact.email),
      firstName: this.clean(contact.first_name),
      lastName: this.clean(contact.last_name),
      company: this.clean(contact.sales_account?.name),
      status: 'new',
    }));
  }

  /**
   * Freshsales has an upsert endpoint that dedupes on a unique identity
   * field, so one call covers create and update.
   */
  async upsertContact(
    apiKey: string,
    host: string | null,
    contact: CrmContactInput,
  ): Promise<CrmContactUpsertResult> {
    const base = this.requireHost(host);
    const { firstName, lastName } = this.splitName(contact);

    const response = await fetch(`${base}/crm/sales/api/contacts/upsert`, {
      method: 'POST',
      headers: { ...this.headers(apiKey), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        unique_identifier: { emails: contact.email },
        contact: {
          first_name: firstName || undefined,
          last_name: lastName || undefined,
          emails: [{ value: contact.email, is_primary: true }],
          job_title: contact.jobTitle || undefined,
          city: contact.city || undefined,
          state: contact.state || undefined,
          country: contact.country || undefined,
          linkedin: contact.linkedinUrl || undefined,
          lead_source: 'AegisLead Prospect Search',
        },
      }),
    });

    if (!response.ok) {
      throw await this.toApiError(response, 'Freshsales contact sync failed');
    }

    const payload = (await response.json()) as {
      contact?: { id?: number; created_at?: string; updated_at?: string };
    };
    const id = payload.contact?.id;
    if (!id) {
      throw new CrmApiError(502, 'Freshsales did not return a contact id');
    }

    return {
      externalId: String(id),
      // Freshsales does not flag which branch it took; equal timestamps mean
      // the record was just created.
      created: payload.contact?.created_at === payload.contact?.updated_at,
    };
  }

  private splitName(contact: CrmContactInput) {
    if (contact.firstName || contact.lastName) {
      return {
        firstName: this.clean(contact.firstName),
        lastName: this.clean(contact.lastName),
      };
    }
    const parts = (contact.name || '').trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return { firstName: null, lastName: null };
    if (parts.length === 1) return { firstName: parts[0], lastName: null };
    return {
      firstName: parts.slice(0, -1).join(' '),
      lastName: parts[parts.length - 1],
    };
  }

  /** Accepts "acme", "acme.myfreshworks.com" or a full URL. */
  private normalizeDomain(domain?: string | null) {
    const raw = (domain || '').trim().replace(/\/+$/, '');
    if (!raw) {
      throw new CrmApiError(
        400,
        'A Freshsales account domain is required (e.g. yourcompany.myfreshworks.com)',
      );
    }
    const withoutScheme = raw.replace(/^https?:\/\//, '');
    const host = withoutScheme.includes('.')
      ? withoutScheme
      : `${withoutScheme}.myfreshworks.com`;
    return `https://${host}`;
  }

  private requireHost(host?: string | null) {
    if (!host) {
      throw new CrmApiError(400, 'Missing Freshsales domain for this connection');
    }
    return host.replace(/\/+$/, '');
  }

  private headers(apiKey: string) {
    return { Authorization: `Token token=${apiKey}` };
  }

  private async toApiError(response: Response, fallback: string) {
    let message = fallback;
    try {
      const body = (await response.json()) as {
        errors?: { message?: string | string[] };
      };
      const detail = body.errors?.message;
      if (Array.isArray(detail)) {
        message = detail.join('; ');
      } else if (typeof detail === 'string' && detail) {
        message = detail;
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
