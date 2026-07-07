import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CompanyRepository } from '../interfaces/prospect-search.interface';
import { ProspectCompany } from '../types/prospect-search.types';

/**
 * Placeholder for a future Clearbit company-data integration. See
 * ApolloCompanyProvider for the rationale behind failing at request time
 * rather than at application startup.
 */
@Injectable()
export class ClearbitCompanyProvider implements CompanyRepository {
  private readonly logger = new Logger(ClearbitCompanyProvider.name);

  constructor(private readonly configService: ConfigService) {}

  private hasApiKey(): boolean {
    return Boolean(this.configService.get<string>('CLEARBIT_API_KEY'));
  }

  // eslint-disable-next-line @typescript-eslint/require-await -- must stay async so the throw below is a proper Promise rejection, not a synchronous throw, matching the CompanyRepository contract
  async findAll(): Promise<ProspectCompany[]> {
    this.logger.warn(
      `Clearbit provider selected but not yet implemented (API key configured: ${this.hasApiKey()}).`,
    );

    throw new ServiceUnavailableException(
      'The Clearbit company-data provider is not yet implemented. Set COMPANY_PROVIDER=mock to use the built-in sample dataset.',
    );
  }
}
