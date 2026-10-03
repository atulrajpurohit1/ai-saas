export interface CrmTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  [key: string]: unknown;
}

export interface CrmAccountMeta {
  portalId: string | null;
  externalAccountName: string | null;
}

export interface NormalizedCrmContact {
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  status: string;
}

export class CrmApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'CrmApiError';
  }
}

export interface CrmContactInput {
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email: string;
  companyName?: string | null;
  website?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  jobTitle?: string | null;
  linkedinUrl?: string | null;
  note?: string | null;
}

export interface CrmContactUpsertResult {
  externalId: string;
  created: boolean;
}

/**
 * How a provider authenticates.
 *
 * 'oauth'   - full redirect dance (HubSpot, GHL, Salesforce, Pipedrive, Zoho).
 * 'api_key' - the tenant pastes a key they generated in the CRM's own UI
 *             (Close, Freshsales, Copper). There is no redirect, no refresh
 *             and no expiry, so the OAuth half of the adapter is unused and
 *             the service must not try to refresh these connections.
 */
export type CrmAuthKind = 'oauth' | 'api_key';

/**
 * A credential field an api_key provider needs the tenant to supply.
 * Copper needs an email alongside the key; Freshsales needs its account
 * subdomain, since the API host is per-account.
 */
export interface CrmCredentialField {
  key: string;
  label: string;
  placeholder?: string;
  helpText?: string;
}

export interface CrmProviderAdapter {
  readonly key: string;
  readonly label: string;
  readonly scopes: string[];
  /** Defaults to 'oauth' when a provider does not declare it. */
  readonly authKind?: CrmAuthKind;
  /** Only meaningful for authKind 'api_key'. */
  readonly credentialFields?: CrmCredentialField[];
  /**
   * Shown in the connect dialog so a customer knows what connecting does
   * and where their credentials come from, without leaving the app.
   */
  readonly setupSteps?: string[];
  /** The CRM's own API-credentials documentation. */
  readonly docsUrl?: string;

  isConfigured(): boolean;
  buildAuthUrl(state: string): string;
  exchangeCode(code: string): Promise<CrmTokenResponse>;
  refreshToken(refreshToken: string): Promise<CrmTokenResponse>;
  extractAccountMeta(token: CrmTokenResponse): CrmAccountMeta;

  /**
   * api_key providers only: validate the supplied credentials against the
   * CRM and return what to persist. Throws CrmApiError on bad credentials.
   */
  verifyCredentials?(
    credentials: Record<string, string>,
  ): Promise<{ token: string; meta: CrmAccountMeta }>;
  fetchContacts(
    accessToken: string,
    locationId?: string | null,
  ): Promise<NormalizedCrmContact[]>;
  upsertContact?(
    accessToken: string,
    locationId: string | null,
    contact: CrmContactInput,
  ): Promise<CrmContactUpsertResult>;
}

export const CRM_PROVIDERS = Symbol('CRM_PROVIDERS');
