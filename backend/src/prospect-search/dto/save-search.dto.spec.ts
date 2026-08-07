import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SaveSearchDto } from './save-search.dto';

describe('SaveSearchDto', () => {
  it('accepts a well-formed save-search payload', async () => {
    const dto = plainToInstance(SaveSearchDto, {
      name: 'Lone Star Guard Services',
      prompt: 'Lone Star Guard Services',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('rejects a payload missing a name', async () => {
    const dto = plainToInstance(SaveSearchDto, {
      name: '',
      prompt: 'Lone Star Guard Services',
    });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects a payload missing a prompt', async () => {
    const dto = plainToInstance(SaveSearchDto, {
      name: 'Lone Star Guard Services',
      prompt: '',
    });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects a name longer than the maximum length', async () => {
    const dto = plainToInstance(SaveSearchDto, {
      name: 'a'.repeat(121),
      prompt: 'Lone Star Guard Services',
    });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });
});
