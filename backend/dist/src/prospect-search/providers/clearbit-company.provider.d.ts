import { ConfigService } from '@nestjs/config';
import { CompanyRepository } from '../interfaces/prospect-search.interface';
import { ProspectCompany } from '../types/prospect-search.types';
export declare class ClearbitCompanyProvider implements CompanyRepository {
    private readonly configService;
    private readonly logger;
    constructor(configService: ConfigService);
    private hasApiKey;
    findAll(): Promise<ProspectCompany[]>;
}
