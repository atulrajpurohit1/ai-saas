import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SearchProspectsDto } from './search-prospects.dto';

describe('SearchProspectsDto', () => {
  it('accepts a well-formed prompt', async () => {
    const dto = plainToInstance(SearchProspectsDto, {
      prompt: 'Find security companies in Texas',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('rejects an empty prompt', async () => {
    const dto = plainToInstance(SearchProspectsDto, { prompt: '' });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects a prompt shorter than the minimum length', async () => {
    const dto = plainToInstance(SearchProspectsDto, { prompt: 'hi' });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects a non-string prompt', async () => {
    const dto = plainToInstance(SearchProspectsDto, { prompt: 12345 });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects a prompt longer than the maximum length', async () => {
    const dto = plainToInstance(SearchProspectsDto, {
      prompt: 'a'.repeat(501),
    });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });
});
