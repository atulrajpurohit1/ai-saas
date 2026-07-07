import { ProspectCompany } from '../types/prospect-search.types';

export const COMPANY_REPOSITORY = Symbol('COMPANY_REPOSITORY');
export const COMPANY_PROVIDER_NAME = Symbol('COMPANY_PROVIDER_NAME');

/**
 * Async so real providers (Apollo, Crunchbase, Clearbit) can make a network
 * call. The mock provider simply resolves immediately with its in-memory
 * dataset - callers always await the result either way.
 */
export interface CompanyRepository {
  findAll(): Promise<ProspectCompany[]>;
}
