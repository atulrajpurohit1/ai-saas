import { CrmAccountMeta, CrmProviderAdapter, CrmTokenResponse, NormalizedCrmContact } from './crm-provider.interface';
export declare class HubspotProvider implements CrmProviderAdapter {
    readonly key = "hubspot";
    readonly label = "HubSpot";
    readonly scopes: string[];
    isConfigured(): boolean;
    buildAuthUrl(state: string): string;
    exchangeCode(code: string): Promise<CrmTokenResponse>;
    refreshToken(refreshToken: string): Promise<CrmTokenResponse>;
    extractAccountMeta(token: CrmTokenResponse): CrmAccountMeta;
    fetchContacts(accessToken: string): Promise<NormalizedCrmContact[]>;
    private clean;
    private clientId;
    private clientSecret;
    private redirectUri;
}
