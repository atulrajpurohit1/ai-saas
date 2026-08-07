import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SearchProspectsDto } from './search-prospects.dto';

describe('SearchProspectsDto', () => {
  it('accepts a well-formed company name', async () => {
    const dto = plainToInstance(SearchProspectsDto, {
      companyName: 'Acme Corp',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('rejects an empty company name', async () => {
    const dto = plainToInstance(SearchProspectsDto, { companyName: '' });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects a non-string company name', async () => {
    const dto = plainToInstance(SearchProspectsDto, { companyName: 12345 });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects a company name longer than the maximum length', async () => {
    const dto = plainToInstance(SearchProspectsDto, {
      companyName: 'a'.repeat(201),
    });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });
});
