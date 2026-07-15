import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ProspectSearchFilters } from '../../ai/ai.service';
import { CompanyRepository } from '../interfaces/prospect-search.interface';
import { ProspectCompany } from '../types/prospect-search.types';
import {
  normalizeApolloOrganization,
  RawApolloOrganization,
} from './company-normalizer';

const APOLLO_SEARCH_URL = 'https://api.apollo.io/v1/mixed_companies/search';
const REQUEST_TIMEOUT_MS = 10_000;
const RESULTS_PER_PAGE = 25;

interface ApolloSearchResponse {
  organizations?: RawApolloOrganization[];
  accounts?: RawApolloOrganization[];
}

/**
 * Live Apollo.io company-data integration. This is the only company data
 * source in the application - there is no hardcoded/sample dataset to fall
 * back to. If Apollo is unreachable or misconfigured, the search fails with
 * a clear, honest error rather than returning fabricated results.
 */
@Injectable()
export class ApolloCompanyProvider implements CompanyRepository {
  private readonly logger = new Logger(ApolloCompanyProvider.name);

  constructor(private readonly configService: ConfigService) {}

  async search(filters: ProspectSearchFilters): Promise<ProspectCompany[]> {
    const apiKey = this.configService.get<string>('APOLLO_API_KEY');

    if (!apiKey) {
      this.logger.error(
        'APOLLO_API_KEY is not configured. Prospect Search cannot return results.',
      );
      throw new ServiceUnavailableException(
        'Prospect Search is not configured. Set APOLLO_API_KEY in the backend environment and restart the server.',
      );
    }

    this.logger.log('Searching Apollo Provider...');
    const raw = await this.callApolloSearch(apiKey, filters);
    this.logger.log(`Apollo returned ${raw.length} companies.`);

    this.logger.log('Normalizing Apollo response.');
    return raw.map(normalizeApolloOrganization);
  }

  private async callApolloSearch(
    apiKey: string,
    filters: ProspectSearchFilters,
  ): Promise<RawApolloOrganization[]> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(APOLLO_SEARCH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'x-api-key': apiKey,
        },
        body: JSON.stringify(this.buildRequestBody(filters)),
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        this.logger.error(
          `Apollo request timed out after ${REQUEST_TIMEOUT_MS}ms`,
        );
        throw new ServiceUnavailableException(
          'The company search provider timed out. Please try again.',
        );
      }
      this.logger.error(
        `Apollo network error: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new ServiceUnavailableException(
        'The company search provider is unreachable right now. Please try again shortly.',
      );
    } finally {
      clearTimeout(timeout);
    }

    if (response.status === 401 || response.status === 403) {
      this.logger.error(
        `Apollo authentication failed (HTTP ${response.status}) - check APOLLO_API_KEY`,
      );
      throw new ServiceUnavailableException(
        'The company search provider rejected the configured API key. Check APOLLO_API_KEY.',
      );
    }

    if (response.status === 429) {
      this.logger.error('Apollo quota exceeded (HTTP 429)');
      throw new ServiceUnavailableException(
        'The company search provider quota has been exceeded. Please try again later.',
      );
    }

    if (!response.ok) {
      this.logger.error(`Apollo server error (HTTP ${response.status})`);
      throw new ServiceUnavailableException(
        'The company search provider returned an error. Please try again shortly.',
      );
    }

    const payload = (await response.json()) as ApolloSearchResponse;
    return payload.organizations ?? payload.accounts ?? [];
  }

  /**
   * Maps our internal filter shape onto Apollo's mixed_companies/search
   * request fields. Only fields the AI actually resolved are included -
   * Apollo treats an omitted field as "no constraint", same as our own
   * ranking engine does for a null filter.
   */
  private buildRequestBody(
    filters: ProspectSearchFilters,
  ): Record<string, unknown> {
    const body: Record<string, unknown> = {
      page: 1,
      per_page: RESULTS_PER_PAGE,
    };

    if (filters.industry) {
      body.q_organization_keyword_tags = [filters.industry];
    }

    const location = [filters.city, filters.state, filters.country]
      .filter((part): part is string => Boolean(part))
      .join(', ');
    if (location) {
      body.organization_locations = [location];
    }

    if (filters.employeeMin !== null || filters.employeeMax !== null) {
      const min = filters.employeeMin ?? 1;
      const max = filters.employeeMax ?? 1_000_000;
      body.organization_num_employees_ranges = [`${min},${max}`];
    }

    if (filters.keywords.length) {
      body.q_keywords = filters.keywords.join(' ');
    }

    return body;
  }
}
