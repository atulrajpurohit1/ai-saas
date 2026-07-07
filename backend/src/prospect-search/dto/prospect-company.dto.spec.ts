import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ProspectCompanyDto } from './prospect-company.dto';

const validCompany = {
  id: 'co-1',
  name: 'Lone Star Guard Services',
  industry: 'Security Services',
  website: 'https://lonestarguard.example.com',
  city: 'Austin',
  state: 'Texas',
  country: 'United States',
  employeeCount: 120,
  revenueRange: '$10M-$50M',
  description: 'Provides commercial security guard services across Texas.',
  matchScore: 80,
};

describe('ProspectCompanyDto', () => {
  it('accepts a well-formed company payload', async () => {
    const dto = plainToInstance(ProspectCompanyDto, validCompany);

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('rejects a payload missing a required field', async () => {
    const { name, ...withoutName } = validCompany;
    void name;
    const dto = plainToInstance(ProspectCompanyDto, withoutName);

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects a matchScore above 100', async () => {
    const dto = plainToInstance(ProspectCompanyDto, {
      ...validCompany,
      matchScore: 150,
    });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects a negative employeeCount', async () => {
    const dto = plainToInstance(ProspectCompanyDto, {
      ...validCompany,
      employeeCount: -5,
    });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });
});
