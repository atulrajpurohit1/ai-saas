import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { ApolloCompanyProvider } from './apollo-company.provider';
import { ClearbitCompanyProvider } from './clearbit-company.provider';
import { CrunchbaseCompanyProvider } from './crunchbase-company.provider';

function buildConfigService(
  overrides: Record<string, string | undefined> = {},
) {
  return {
    get: jest.fn((key: string) => overrides[key]),
  } as unknown as ConfigService;
}

describe('Placeholder company providers', () => {
  it('ApolloCompanyProvider throws a meaningful configuration error when used', async () => {
    const provider = new ApolloCompanyProvider(buildConfigService());

    await expect(provider.findAll()).rejects.toThrow(
      ServiceUnavailableException,
    );
    await expect(provider.findAll()).rejects.toThrow(/Apollo/);
  });

  it('CrunchbaseCompanyProvider throws a meaningful configuration error when used', async () => {
    const provider = new CrunchbaseCompanyProvider(buildConfigService());

    await expect(provider.findAll()).rejects.toThrow(
      ServiceUnavailableException,
    );
    await expect(provider.findAll()).rejects.toThrow(/Crunchbase/);
  });

  it('ClearbitCompanyProvider throws a meaningful configuration error when used', async () => {
    const provider = new ClearbitCompanyProvider(buildConfigService());

    await expect(provider.findAll()).rejects.toThrow(
      ServiceUnavailableException,
    );
    await expect(provider.findAll()).rejects.toThrow(/Clearbit/);
  });
});
