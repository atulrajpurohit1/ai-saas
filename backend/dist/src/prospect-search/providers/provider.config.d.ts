export declare const SUPPORTED_COMPANY_PROVIDERS: readonly ["apollo", "crunchbase", "clearbit"];
export type CompanyProviderName = (typeof SUPPORTED_COMPANY_PROVIDERS)[number];
export declare const ACTIVE_COMPANY_PROVIDERS: CompanyProviderName[];
export declare function resolveCompanyProviderName(rawValue: string | undefined | null): CompanyProviderName;
