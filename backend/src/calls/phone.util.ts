import { BadRequestException } from '@nestjs/common';

/**
 * Normalises a user-entered phone number to E.164 (+ followed by digits).
 *
 * This is deliberately NOT a full libphonenumber-grade parse. It cannot tell a
 * valid subscriber number from an invalid one, and it does not know area code
 * rules for any country. What it does guarantee is that whatever lands in a
 * tel: link is syntactically dialable, because a malformed tel: URI fails
 * silently on the rep's handset -- the dialer just opens blank, which is a
 * miserable thing to debug from a support ticket.
 *
 * Anything stricter belongs in libphonenumber if real validation is wanted.
 */

/** E.164 allows at most 15 digits; ITU reserves a minimum around 7 in practice. */
const E164_MAX_DIGITS = 15;
const MIN_DIGITS = 7;

export function normalizePhoneNumber(
  raw: string,
  defaultCountryCode?: string,
): string {
  if (typeof raw !== 'string' || !raw.trim()) {
    throw new BadRequestException('Phone number is required');
  }

  const trimmed = raw.trim();

  // Strip the formatting humans type: spaces, dashes, dots, brackets. A leading
  // "+" is meaningful and kept; "00" is the other international prefix in wide
  // use and means the same thing.
  let digits = trimmed.replace(/[\s().-]/g, '');
  let hasPlus = digits.startsWith('+');
  if (hasPlus) {
    digits = digits.slice(1);
  } else if (digits.startsWith('00')) {
    digits = digits.slice(2);
    hasPlus = true;
  }

  if (!/^\d+$/.test(digits)) {
    throw new BadRequestException(
      `"${trimmed}" is not a valid phone number. Use digits, optionally starting with +.`,
    );
  }

  // No country code given and none in the number: we cannot invent one. Guessing
  // would dial a real but wrong number in another country, so refuse instead.
  if (!hasPlus) {
    const cc = (defaultCountryCode || '').replace(/[^\d]/g, '');
    if (!cc) {
      throw new BadRequestException(
        `"${trimmed}" has no country code. Enter it in international format, e.g. +14155551234.`,
      );
    }
    // A national number conventionally written with a trunk prefix "0" drops it
    // when the country code is prepended.
    digits = cc + digits.replace(/^0+/, '');
  }

  if (digits.length < MIN_DIGITS || digits.length > E164_MAX_DIGITS) {
    throw new BadRequestException(
      `"${trimmed}" is not a valid phone number length.`,
    );
  }

  return `+${digits}`;
}

/** True when the value can be normalised; used for soft checks, never for dialing. */
export function isDialable(raw?: string | null, defaultCountryCode?: string) {
  if (!raw) return false;
  try {
    normalizePhoneNumber(raw, defaultCountryCode);
    return true;
  } catch {
    return false;
  }
}
