import { resolveCompanyProviderName } from './provider.config';

describe('resolveCompanyProviderName', () => {
  it('defaults to apollo when no value is configured', () => {
    expect(resolveCompanyProviderName(undefined)).toBe('apollo');
    expect(resolveCompanyProviderName(null)).toBe('apollo');
    expect(resolveCompanyProviderName('')).toBe('apollo');
  });

  it('accepts every supported provider name, case-insensitively', () => {
    expect(resolveCompanyProviderName('APOLLO')).toBe('apollo');
    expect(resolveCompanyProviderName(' Crunchbase ')).toBe('crunchbase');
    expect(resolveCompanyProviderName('clearbit')).toBe('clearbit');
  });

  it('throws a meaningful error for an unrecognized provider name', () => {
    expect(() => resolveCompanyProviderName('salesforce')).toThrow(
      /Invalid COMPANY_PROVIDER "salesforce"/,
    );
    expect(() => resolveCompanyProviderName('mock')).toThrow(
      /Invalid COMPANY_PROVIDER "mock"/,
    );
  });
});
