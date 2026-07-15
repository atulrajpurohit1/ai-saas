import { ConfigService } from '@nestjs/config';
import { ProspectSearchFilters } from '../../ai/ai.service';
import { CompanyRepository } from '../interfaces/prospect-search.interface';
import { ProspectCompany } from '../types/prospect-search.types';
export declare class CrunchbaseCompanyProvider implements CompanyRepository {
    private readonly configService;
    private readonly logger;
    constructor(configService: ConfigService);
    private hasApiKey;
    search(filters: ProspectSearchFilters): Promise<ProspectCompany[]>;
}
