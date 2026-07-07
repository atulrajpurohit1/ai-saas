import { ProspectCompany } from '../types/prospect-search.types';
export interface RawApolloOrganization {
    id: string;
    name: string;
    industry?: string | null;
    website_url?: string | null;
    city?: string | null;
    state?: string | null;
    country?: string | null;
    estimated_num_employees?: number | null;
    annual_revenue_range?: string | null;
    short_description?: string | null;
}
export interface RawCrunchbaseOrganization {
    uuid: string;
    properties: {
        name: string;
        categories?: string[];
        website?: {
            value: string;
        } | null;
        city_name?: string | null;
        region_name?: string | null;
        country_code?: string | null;
        num_employees_enum?: string | null;
        revenue_range?: string | null;
        short_description?: string | null;
    };
}
export interface RawClearbitCompany {
    id: string;
    name: string;
    category?: {
        industry?: string | null;
    } | null;
    domain?: string | null;
    geo?: {
        city?: string | null;
        state?: string | null;
        country?: string | null;
    } | null;
    metrics?: {
        employees?: number | null;
        estimatedAnnualRevenue?: string | null;
    } | null;
    description?: string | null;
}
export declare function normalizeApolloOrganization(raw: RawApolloOrganization): ProspectCompany;
export declare function normalizeCrunchbaseOrganization(raw: RawCrunchbaseOrganization): ProspectCompany;
export declare function normalizeClearbitCompany(raw: RawClearbitCompany): ProspectCompany;
