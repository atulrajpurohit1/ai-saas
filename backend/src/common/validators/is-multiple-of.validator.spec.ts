import { validate } from 'class-validator';
import { IsOptional } from 'class-validator';
import { IsMultipleOf } from './is-multiple-of.validator';

class CoverageHolder {
  @IsOptional()
  @IsMultipleOf(100)
  amount?: number;
}

async function firstErrorFor(value: unknown): Promise<boolean> {
  const holder = new CoverageHolder();
  // @ts-expect-error — intentionally assigning arbitrary test values.
  holder.amount = value;
  const errors = await validate(holder);
  return errors.length === 0;
}

describe('IsMultipleOf(100)', () => {
  it('accepts exact multiples of 100', async () => {
    expect(await firstErrorFor(0)).toBe(true);
    expect(await firstErrorFor(100)).toBe(true);
    expect(await firstErrorFor(1_000_000)).toBe(true);
  });

  it('rejects values that do not end in 00', async () => {
    expect(await firstErrorFor(150)).toBe(false);
    expect(await firstErrorFor(99)).toBe(false);
    expect(await firstErrorFor(15001)).toBe(false);
  });

  it('passes when the value is omitted (paired with @IsOptional)', async () => {
    expect(await firstErrorFor(undefined)).toBe(true);
  });

  it('rejects non-finite numbers', async () => {
    expect(await firstErrorFor(Number.NaN)).toBe(false);
    expect(await firstErrorFor(Number.POSITIVE_INFINITY)).toBe(false);
  });
});
