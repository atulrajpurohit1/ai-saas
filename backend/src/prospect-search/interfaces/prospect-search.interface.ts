import { ProspectSearchFilters } from '../../ai/ai.service';
import { ProspectCompany } from '../types/prospect-search.types';

export const COMPANY_REPOSITORY = Symbol('COMPANY_REPOSITORY');
export const COMPANY_PROVIDER_NAME = Symbol('COMPANY_PROVIDER_NAME');

/**
 * The single abstraction every company-data source implements (mock, Apollo,
 * Crunchbase, Clearbit, or any future provider). ProspectSearchService only
 * ever talks to this interface - it never knows which concrete provider is
 * active. Filters are passed in so a real provider can query its own search
 * endpoint directly instead of pulling an entire dataset; the mock provider
 * simply ignores them and returns its full in-memory sample set. Async so
 * real providers can make a network call - callers always await either way.
 */
export interface CompanyRepository {
  search(filters: ProspectSearchFilters): Promise<ProspectCompany[]>;
}
