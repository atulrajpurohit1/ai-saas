import { BadRequestException } from '@nestjs/common';
import { isDialable, normalizePhoneNumber } from './phone.util';

describe('normalizePhoneNumber', () => {
  it('keeps an already-E.164 number unchanged', () => {
    expect(normalizePhoneNumber('+14155551234')).toBe('+14155551234');
  });

  it('strips the punctuation people actually type', () => {
    expect(normalizePhoneNumber('+1 (415) 555-1234')).toBe('+14155551234');
    expect(normalizePhoneNumber('+44 20 7946 0958')).toBe('+442079460958');
    expect(normalizePhoneNumber('+1.415.555.1234')).toBe('+14155551234');
  });

  it('treats a 00 prefix as the international prefix it is', () => {
    expect(normalizePhoneNumber('0044 20 7946 0958')).toBe('+442079460958');
  });

  it('applies a default country code to a national number', () => {
    expect(normalizePhoneNumber('4155551234', '1')).toBe('+14155551234');
    expect(normalizePhoneNumber('9876543210', '+91')).toBe('+919876543210');
  });

  it('drops the trunk prefix when prepending a country code', () => {
    // 020 7946 0958 is how this number is written nationally in the UK; the
    // leading 0 is a trunk code and must not survive into E.164.
    expect(normalizePhoneNumber('020 7946 0958', '44')).toBe('+442079460958');
  });

  it('refuses a national number when no country code is available', () => {
    // Guessing here would dial a real but wrong number in another country.
    expect(() => normalizePhoneNumber('4155551234')).toThrow(BadRequestException);
  });

  it('rejects letters and other junk', () => {
    expect(() => normalizePhoneNumber('+1-800-FLOWERS')).toThrow(BadRequestException);
    expect(() => normalizePhoneNumber('not a number')).toThrow(BadRequestException);
  });

  it('rejects empty and whitespace-only input', () => {
    expect(() => normalizePhoneNumber('')).toThrow(BadRequestException);
    expect(() => normalizePhoneNumber('   ')).toThrow(BadRequestException);
    expect(() => normalizePhoneNumber(undefined as unknown as string)).toThrow(
      BadRequestException,
    );
  });

  it('enforces E.164 length bounds', () => {
    expect(() => normalizePhoneNumber('+1234')).toThrow(BadRequestException);
    expect(() => normalizePhoneNumber('+1234567890123456')).toThrow(
      BadRequestException,
    );
    // 15 digits is the E.164 maximum and must still be accepted.
    expect(normalizePhoneNumber('+123456789012345')).toBe('+123456789012345');
  });
});

describe('isDialable', () => {
  it('is false for absent or unusable values rather than throwing', () => {
    expect(isDialable(null)).toBe(false);
    expect(isDialable(undefined)).toBe(false);
    expect(isDialable('')).toBe(false);
    expect(isDialable('nonsense')).toBe(false);
    expect(isDialable('4155551234')).toBe(false);
  });

  it('is true for a number that normalises', () => {
    expect(isDialable('+14155551234')).toBe(true);
    expect(isDialable('4155551234', '1')).toBe(true);
  });
});
