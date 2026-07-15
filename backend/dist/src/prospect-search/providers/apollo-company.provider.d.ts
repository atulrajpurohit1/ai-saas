import { ConfigService } from '@nestjs/config';
import { ProspectSearchFilters } from '../../ai/ai.service';
import { CompanyRepository } from '../interfaces/prospect-search.interface';
import { ProspectCompany } from '../types/prospect-search.types';
export declare class ApolloCompanyProvider implements CompanyRepository {
    private readonly configService;
    private readonly logger;
    constructor(configService: ConfigService);
    search(filters: ProspectSearchFilters): Promise<ProspectCompany[]>;
    private callApolloSearch;
    private buildRequestBody;
}
