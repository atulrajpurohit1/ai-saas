import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CompanyRepository } from '../interfaces/prospect-search.interface';
import { ProspectCompany } from '../types/prospect-search.types';

/**
 * Placeholder for a future Apollo.io company-data integration. Selecting
 * COMPANY_PROVIDER=apollo lets the application boot normally - only an actual
 * prospect search request fails, with a clear configuration error, until this
 * provider is built out with a real API client.
 *
 * Reads APOLLO_API_KEY via ConfigService (never hardcoded, never logged) so
 * the credential wiring is already in place for when the real integration
 * lands - only the HTTP call itself is missing.
 */
@Injectable()
export class ApolloCompanyProvider implements CompanyRepository {
  private readonly logger = new Logger(ApolloCompanyProvider.name);

  constructor(private readonly configService: ConfigService) {}

  private hasApiKey(): boolean {
    return Boolean(this.configService.get<string>('APOLLO_API_KEY'));
  }

  // eslint-disable-next-line @typescript-eslint/require-await -- must stay async so the throw below is a proper Promise rejection, not a synchronous throw, matching the CompanyRepository contract
  async findAll(): Promise<ProspectCompany[]> {
    this.logger.warn(
      `Apollo provider selected but not yet implemented (API key configured: ${this.hasApiKey()}).`,
    );

    throw new ServiceUnavailableException(
      'The Apollo company-data provider is not yet implemented. Set COMPANY_PROVIDER=mock to use the built-in sample dataset.',
    );
  }
}
