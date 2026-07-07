import { Injectable } from '@nestjs/common';
import { MOCK_COMPANIES } from './data/mock-companies.data';
import { CompanyRepository } from './interfaces/prospect-search.interface';
import { ProspectCompany } from './types/prospect-search.types';

/**
 * Temporary stand-in for a real company-data provider (e.g. Apollo).
 * Implements CompanyRepository so it can be swapped for a live provider
 * later by changing the module's provider binding only.
 */
@Injectable()
export class MockCompanyRepositoryService implements CompanyRepository {
  findAll(): Promise<ProspectCompany[]> {
    return Promise.resolve(MOCK_COMPANIES);
  }
}
