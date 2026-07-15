import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { ProspectSearchFilters } from '../../ai/ai.service';
import { ClearbitCompanyProvider } from './clearbit-company.provider';
import { CrunchbaseCompanyProvider } from './crunchbase-company.provider';

function buildConfigService(
  overrides: Record<string, string | undefined> = {},
) {
  return {
    get: jest.fn((key: string) => overrides[key]),
  } as unknown as ConfigService;
}

const FILTERS: ProspectSearchFilters = {
  industry: null,
  city: null,
  state: null,
  country: null,
  employeeMin: null,
  employeeMax: null,
  revenueRange: null,
  keywords: [],
};

describe('Placeholder company providers', () => {
  it('CrunchbaseCompanyProvider throws a meaningful configuration error when used', async () => {
    const provider = new CrunchbaseCompanyProvider(buildConfigService());

    await expect(provider.search(FILTERS)).rejects.toThrow(
      ServiceUnavailableException,
    );
    await expect(provider.search(FILTERS)).rejects.toThrow(/Crunchbase/);
  });

  it('ClearbitCompanyProvider throws a meaningful configuration error when used', async () => {
    const provider = new ClearbitCompanyProvider(buildConfigService());

    await expect(provider.search(FILTERS)).rejects.toThrow(
      ServiceUnavailableException,
    );
    await expect(provider.search(FILTERS)).rejects.toThrow(/Clearbit/);
  });
});
