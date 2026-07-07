import { resolveCompanyProviderName } from './provider.config';

describe('resolveCompanyProviderName', () => {
  it('defaults to mock when no value is configured', () => {
    expect(resolveCompanyProviderName(undefined)).toBe('mock');
    expect(resolveCompanyProviderName(null)).toBe('mock');
    expect(resolveCompanyProviderName('')).toBe('mock');
  });

  it('accepts every supported provider name, case-insensitively', () => {
    expect(resolveCompanyProviderName('mock')).toBe('mock');
    expect(resolveCompanyProviderName('APOLLO')).toBe('apollo');
    expect(resolveCompanyProviderName(' Crunchbase ')).toBe('crunchbase');
    expect(resolveCompanyProviderName('clearbit')).toBe('clearbit');
  });

  it('throws a meaningful error for an unrecognized provider name', () => {
    expect(() => resolveCompanyProviderName('salesforce')).toThrow(
      /Invalid COMPANY_PROVIDER "salesforce"/,
    );
  });
});
