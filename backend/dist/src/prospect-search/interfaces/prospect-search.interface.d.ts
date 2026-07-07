import { ProspectCompany } from '../types/prospect-search.types';
export declare const COMPANY_REPOSITORY: unique symbol;
export declare const COMPANY_PROVIDER_NAME: unique symbol;
export interface CompanyRepository {
    findAll(): Promise<ProspectCompany[]>;
}
