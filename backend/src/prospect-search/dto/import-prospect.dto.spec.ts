import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ImportProspectDto } from './import-prospect.dto';

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

describe('ImportProspectDto', () => {
  it('accepts a payload with a valid nested company and no force flag', async () => {
    const dto = plainToInstance(ImportProspectDto, { company: validCompany });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('accepts a payload with force explicitly set', async () => {
    const dto = plainToInstance(ImportProspectDto, {
      company: validCompany,
      force: true,
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('rejects a payload with an invalid nested company', async () => {
    const { name, ...invalidCompany } = validCompany;
    void name;
    const dto = plainToInstance(ImportProspectDto, { company: invalidCompany });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects a non-boolean force flag', async () => {
    const dto = plainToInstance(ImportProspectDto, {
      company: validCompany,
      force: 'yes',
    });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });
});
