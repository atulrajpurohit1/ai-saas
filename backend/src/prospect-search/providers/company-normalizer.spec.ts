import {
  normalizeApolloOrganization,
  normalizeClearbitCompany,
  normalizeCrunchbaseOrganization,
} from './company-normalizer';

describe('company-normalizer', () => {
  it('normalizes a raw Apollo organization into a ProspectCompany', () => {
    const result = normalizeApolloOrganization({
      id: 'apollo-1',
      name: 'Lone Star Guard Services',
      industry: 'Security Services',
      website_url: 'https://lonestarguard.example.com',
      city: 'Austin',
      state: 'Texas',
      country: 'United States',
      estimated_num_employees: 120,
      annual_revenue_range: '$10M-$50M',
      short_description: 'Provides guard services.',
    });

    expect(result).toEqual({
      id: 'apollo-1',
      name: 'Lone Star Guard Services',
      industry: 'Security Services',
      website: 'https://lonestarguard.example.com',
      city: 'Austin',
      state: 'Texas',
      country: 'United States',
      employeeCount: 120,
      revenueRange: '$10M-$50M',
      description: 'Provides guard services.',
    });
  });

  it('falls back to safe defaults for missing optional Apollo fields', () => {
    const result = normalizeApolloOrganization({
      id: 'apollo-2',
      name: 'Unknown Co',
    });

    expect(result.industry).toBe('Unknown');
    expect(result.website).toBe('');
    expect(result.employeeCount).toBe(0);
    expect(result.revenueRange).toBe('Unknown');
  });

  it('normalizes a raw Crunchbase organization, converting the employee enum to a midpoint estimate', () => {
    const result = normalizeCrunchbaseOrganization({
      uuid: 'cb-1',
      properties: {
        name: 'Gulf Coast Security Partners',
        categories: ['Security Services'],
        website: { value: 'https://gulfcoastsecurity.example.com' },
        city_name: 'Houston',
        region_name: 'Texas',
        country_code: 'US',
        num_employees_enum: 'c_00051_00100',
        revenue_range: '$50M-$100M',
        short_description: 'Large-scale guarding provider.',
      },
    });

    expect(result).toEqual({
      id: 'cb-1',
      name: 'Gulf Coast Security Partners',
      industry: 'Security Services',
      website: 'https://gulfcoastsecurity.example.com',
      city: 'Houston',
      state: 'Texas',
      country: 'US',
      employeeCount: 76,
      revenueRange: '$50M-$100M',
      description: 'Large-scale guarding provider.',
    });
  });

  it('normalizes a raw Clearbit company, deriving a website URL from the domain', () => {
    const result = normalizeClearbitCompany({
      id: 'clearbit-1',
      name: 'Sierra Vista Security Group',
      category: { industry: 'Security Services' },
      domain: 'sierravistasecurity.example.com',
      geo: {
        city: 'Sacramento',
        state: 'California',
        country: 'United States',
      },
      metrics: { employees: 150, estimatedAnnualRevenue: '$10M-$50M' },
      description: 'Uniformed guard services.',
    });

    expect(result).toEqual({
      id: 'clearbit-1',
      name: 'Sierra Vista Security Group',
      industry: 'Security Services',
      website: 'https://sierravistasecurity.example.com',
      city: 'Sacramento',
      state: 'California',
      country: 'United States',
      employeeCount: 150,
      revenueRange: '$10M-$50M',
      description: 'Uniformed guard services.',
    });
  });
});
