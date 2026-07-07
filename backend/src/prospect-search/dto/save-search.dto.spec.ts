import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SaveSearchDto } from './save-search.dto';

const validFilters = {
  industry: 'Security Services',
  city: null,
  state: 'Texas',
  country: null,
  employeeMin: 50,
  employeeMax: 200,
  revenueRange: null,
  keywords: ['security'],
};

describe('SaveSearchDto', () => {
  it('accepts a well-formed save-search payload', async () => {
    const dto = plainToInstance(SaveSearchDto, {
      name: 'Texas security prospects',
      prompt: 'Find security companies in Texas',
      filters: validFilters,
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('rejects a payload missing a name', async () => {
    const dto = plainToInstance(SaveSearchDto, {
      name: '',
      prompt: 'Find security companies in Texas',
      filters: validFilters,
    });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects a payload with invalid nested filters', async () => {
    const dto = plainToInstance(SaveSearchDto, {
      name: 'Texas security prospects',
      prompt: 'Find security companies in Texas',
      filters: { ...validFilters, employeeMin: -5 },
    });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects a name longer than the maximum length', async () => {
    const dto = plainToInstance(SaveSearchDto, {
      name: 'a'.repeat(121),
      prompt: 'Find security companies in Texas',
      filters: validFilters,
    });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });
});
