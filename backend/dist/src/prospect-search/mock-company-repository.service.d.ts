import { CompanyRepository } from './interfaces/prospect-search.interface';
import { ProspectCompany } from './types/prospect-search.types';
export declare class MockCompanyRepositoryService implements CompanyRepository {
    findAll(): Promise<ProspectCompany[]>;
}
