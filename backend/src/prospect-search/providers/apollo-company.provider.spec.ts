import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { ProspectSearchFilters } from '../../ai/ai.service';
import { ApolloCompanyProvider } from './apollo-company.provider';

function buildConfigService(
  overrides: Record<string, string | undefined> = {},
) {
  return {
    get: jest.fn((key: string) => overrides[key]),
  } as unknown as ConfigService;
}

const FILTERS: ProspectSearchFilters = {
  industry: 'Security',
  city: 'Austin',
  state: 'Texas',
  country: 'United States',
  employeeMin: 50,
  employeeMax: 200,
  revenueRange: null,
  keywords: ['guard', 'patrol'],
};

const RAW_ORGANIZATION = {
  id: 'apollo-1',
  name: 'Apollo Test Co',
  industry: 'Security',
  website_url: 'https://apollotest.example.com',
  city: 'Austin',
  state: 'Texas',
  country: 'United States',
  estimated_num_employees: 120,
  annual_revenue_range: '$10M-$50M',
  short_description: 'A test company returned by Apollo.',
};

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

describe('ApolloCompanyProvider', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('throws a clear configuration error when APOLLO_API_KEY is not set', async () => {
    const fetchSpy = jest.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;

    const provider = new ApolloCompanyProvider(buildConfigService());

    await expect(provider.search(FILTERS)).rejects.toThrow(
      ServiceUnavailableException,
    );
    await expect(provider.search(FILTERS)).rejects.toThrow(/APOLLO_API_KEY/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('calls Apollo and normalizes results when a key is configured and the call succeeds', async () => {
    const fetchSpy = jest
      .fn()
      .mockResolvedValue(
        jsonResponse(200, { organizations: [RAW_ORGANIZATION] }),
      );
    global.fetch = fetchSpy as unknown as typeof fetch;

    const provider = new ApolloCompanyProvider(
      buildConfigService({ APOLLO_API_KEY: 'test-key' }),
    );

    const results = await provider.search(FILTERS);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.apollo.io/v1/mixed_companies/search');
    expect((init.headers as Record<string, string>)['x-api-key']).toBe(
      'test-key',
    );

    expect(results).toEqual([
      {
        id: 'apollo-1',
        name: 'Apollo Test Co',
        industry: 'Security',
        website: 'https://apollotest.example.com',
        city: 'Austin',
        state: 'Texas',
        country: 'United States',
        employeeCount: 120,
        revenueRange: '$10M-$50M',
        description: 'A test company returned by Apollo.',
      },
    ]);
  });

  it('falls back to the accounts field when organizations is absent', async () => {
    const fetchSpy = jest
      .fn()
      .mockResolvedValue(jsonResponse(200, { accounts: [RAW_ORGANIZATION] }));
    global.fetch = fetchSpy as unknown as typeof fetch;

    const provider = new ApolloCompanyProvider(
      buildConfigService({ APOLLO_API_KEY: 'test-key' }),
    );

    const results = await provider.search(FILTERS);

    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('apollo-1');
  });

  it('throws a clear error on a 401 (invalid key)', async () => {
    const fetchSpy = jest.fn().mockResolvedValue(jsonResponse(401, {}));
    global.fetch = fetchSpy as unknown as typeof fetch;

    const provider = new ApolloCompanyProvider(
      buildConfigService({ APOLLO_API_KEY: 'bad-key' }),
    );

    await expect(provider.search(FILTERS)).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  it('throws a clear error on a 429 (quota exceeded)', async () => {
    const fetchSpy = jest.fn().mockResolvedValue(jsonResponse(429, {}));
    global.fetch = fetchSpy as unknown as typeof fetch;

    const provider = new ApolloCompanyProvider(
      buildConfigService({ APOLLO_API_KEY: 'test-key' }),
    );

    await expect(provider.search(FILTERS)).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  it('throws a clear error on a 5xx server error', async () => {
    const fetchSpy = jest.fn().mockResolvedValue(jsonResponse(500, {}));
    global.fetch = fetchSpy as unknown as typeof fetch;

    const provider = new ApolloCompanyProvider(
      buildConfigService({ APOLLO_API_KEY: 'test-key' }),
    );

    await expect(provider.search(FILTERS)).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  it('throws a clear error on a network failure', async () => {
    const fetchSpy = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    global.fetch = fetchSpy as unknown as typeof fetch;

    const provider = new ApolloCompanyProvider(
      buildConfigService({ APOLLO_API_KEY: 'test-key' }),
    );

    await expect(provider.search(FILTERS)).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  it('throws a clear error on a timeout (AbortError)', async () => {
    const abortError = new Error('The operation was aborted');
    abortError.name = 'AbortError';
    const fetchSpy = jest.fn().mockRejectedValue(abortError);
    global.fetch = fetchSpy as unknown as typeof fetch;

    const provider = new ApolloCompanyProvider(
      buildConfigService({ APOLLO_API_KEY: 'test-key' }),
    );

    await expect(provider.search(FILTERS)).rejects.toThrow(
      ServiceUnavailableException,
    );
  });
});
