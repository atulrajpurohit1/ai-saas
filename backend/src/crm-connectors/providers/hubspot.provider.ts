import { BadRequestException, Injectable } from '@nestjs/common';
import {
  CrmAccountMeta,
  CrmProviderAdapter,
  CrmTokenResponse,
  NormalizedCrmContact,
} from './crm-provider.interface';

const AUTH_URL = 'https://app.hubspot.com/oauth/authorize';
const TOKEN_URL = 'https://api.hubapi.com/oauth/v1/token';
const CONTACTS_URL = 'https://api.hubapi.com/crm/v3/objects/contacts';
const SCOPES = ['crm.objects.contacts.read'];

@Injectable()
export class HubspotProvider implements CrmProviderAdapter {
  readonly key = 'hubspot';
  readonly label = 'HubSpot';
  readonly scopes = SCOPES;

  isConfigured() {
    return Boolean(this.clientId() && this.clientSecret() && this.redirectUri());
  }

  buildAuthUrl(state: string) {
    if (!this.isConfigured()) {
      throw new BadRequestException(
        'HubSpot OAuth environment variables are not configured',
      );
    }
    const params = new URLSearchParams({
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
      throw new BadRequestException('HubSpot token exchange failed');
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
      throw new BadRequestException('HubSpot token refresh failed');
    }

    return response.json();
  }

  extractAccountMeta(token: CrmTokenResponse): CrmAccountMeta {
    return {
      portalId: token.hub_id ? String(token.hub_id) : null,
      externalAccountName: (token.hub_domain as string) || null,
    };
  }

  async fetchContacts(accessToken: string): Promise<NormalizedCrmContact[]> {
    const url = new URL(CONTACTS_URL);
    url.searchParams.set('limit', '100');
    url.searchParams.set(
      'properties',
      'firstname,lastname,email,company,hs_lead_status',
    );

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      const message = await response.text();
      throw new BadRequestException(
        message || `HubSpot contact import failed: ${response.status}`,
      );
    }

    const payload = (await response.json()) as {
      results?: Array<{
        id: string;
        properties?: Record<string, string | null>;
      }>;
    };

    return (payload.results || []).map((contact) => {
      const properties = contact.properties || {};
      return {
        email: this.clean(properties.email),
        firstName: this.clean(properties.firstname),
        lastName: this.clean(properties.lastname),
        company: this.clean(properties.company),
        status: this.clean(properties.hs_lead_status)?.toLowerCase() || 'new',
      };
    });
  }

  private clean(value?: string | null) {
    const trimmed = value?.trim();
    return trimmed || null;
  }

  private clientId() {
    return process.env.HUBSPOT_CLIENT_ID || '';
  }

  private clientSecret() {
    return process.env.HUBSPOT_CLIENT_SECRET || '';
  }

  private redirectUri() {
    return process.env.HUBSPOT_REDIRECT_URI || '';
  }
}
