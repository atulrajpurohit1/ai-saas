import { CrmAccountMeta, CrmContactInput, CrmContactUpsertResult, CrmProviderAdapter, CrmTokenResponse, NormalizedCrmContact } from './crm-provider.interface';
export declare class GhlProvider implements CrmProviderAdapter {
    readonly key = "ghl";
    readonly label = "GoHighLevel";
    readonly scopes: string[];
    isConfigured(): boolean;
    buildAuthUrl(state: string): string;
    exchangeCode(code: string): Promise<CrmTokenResponse>;
    refreshToken(refreshToken: string): Promise<CrmTokenResponse>;
    extractAccountMeta(token: CrmTokenResponse): CrmAccountMeta;
    fetchContacts(accessToken: string, locationId?: string | null): Promise<NormalizedCrmContact[]>;
    upsertContact(accessToken: string, locationId: string | null, contact: CrmContactInput): Promise<CrmContactUpsertResult>;
    private buildNote;
    private addNote;
    private toApiError;
    private clean;
    private clientId;
    private clientSecret;
    private redirectUri;
}
