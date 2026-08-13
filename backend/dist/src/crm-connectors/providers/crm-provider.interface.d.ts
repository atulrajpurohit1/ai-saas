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
export declare class CrmApiError extends Error {
    readonly status: number;
    constructor(status: number, message: string);
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
export interface CrmProviderAdapter {
    readonly key: string;
    readonly label: string;
    readonly scopes: string[];
    isConfigured(): boolean;
    buildAuthUrl(state: string): string;
    exchangeCode(code: string): Promise<CrmTokenResponse>;
    refreshToken(refreshToken: string): Promise<CrmTokenResponse>;
    extractAccountMeta(token: CrmTokenResponse): CrmAccountMeta;
    fetchContacts(accessToken: string, locationId?: string | null): Promise<NormalizedCrmContact[]>;
    upsertContact?(accessToken: string, locationId: string | null, contact: CrmContactInput): Promise<CrmContactUpsertResult>;
}
export declare const CRM_PROVIDERS: unique symbol;
