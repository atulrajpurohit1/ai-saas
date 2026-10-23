// Shared client-side input helpers. Two kinds live here:
//
//  - sanitizers (sanitizePhone, sanitizeDecimal, ...) run in an input's
//    onChange to stop bad characters being typed at all (e.g. letters in a
//    price, an 11th phone digit), so the field can never hold junk.
//  - validators (isValidEmail, validatePhone, ...) run at submit time to show
//    a clear message for anything a sanitizer can't prevent (e.g. a half-typed
//    phone number, an empty required field).
//
// These back the form-validation pass in issue 22. The server still validates
// everything; this is purely about catching mistakes before a round-trip.

/** Max digits in a phone number. Local numbers are 10; this is the cap the
 *  product asked for. */
export const PHONE_MAX_DIGITS = 10;

/** Keeps only digits and trims to `maxDigits`. Use in a phone field's
 *  onChange so an 11th digit (or any letter) simply cannot be entered. */
export function sanitizePhone(raw: string, maxDigits = PHONE_MAX_DIGITS): string {
  return raw.replace(/\D/g, '').slice(0, maxDigits);
}

/**
 * Keeps a decimal money/number value clean: digits and at most one dot, with
 * at most two fractional digits. Rejects letters and stray symbols as they are
 * typed, so a price field can never contain "12a.5" or "1.2.3".
 */
export function sanitizeDecimal(raw: string, maxDecimals = 2): string {
  let cleaned = raw.replace(/[^\d.]/g, '');
  const firstDot = cleaned.indexOf('.');
  if (firstDot !== -1) {
    // Drop any dots after the first.
    cleaned =
      cleaned.slice(0, firstDot + 1) +
      cleaned.slice(firstDot + 1).replace(/\./g, '');
    const [whole, frac] = cleaned.split('.');
    cleaned = `${whole}.${frac.slice(0, maxDecimals)}`;
  }
  return cleaned;
}

/** Keeps only digits (no decimal) - for counts/quantities. */
export function sanitizeInteger(raw: string, maxLen = 9): string {
  return raw.replace(/\D/g, '').slice(0, maxLen);
}

/**
 * Lenient phone sanitizer for fields that must accept a country code (e.g. a
 * sales lead's number, which is dialed in E.164 form). Allows a single leading
 * "+" and digits, up to 15 digits (the E.164 maximum). NOT for local-only
 * fields that should be capped at 10 - use sanitizePhone for those.
 */
export function sanitizePhoneIntl(raw: string): string {
  const hasPlus = raw.trim().startsWith('+');
  const digits = raw.replace(/\D/g, '').slice(0, 15);
  return hasPlus ? `+${digits}` : digits;
}

// Deliberately simple and permissive: catches the obvious typos ("a@b",
// "no-at-sign") without trying to fully model RFC 5322, which the server and
// the actual mail send are the real authority on.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email.trim());
}

/** Error string for an email field, or null when it's fine. Empty is allowed
 *  here; pair with a required check when the field is mandatory. */
export function validateEmail(email: string): string | null {
  const value = email.trim();
  if (!value) return null;
  return isValidEmail(value) ? null : 'Enter a valid email address.';
}

/** Error string for a phone field, or null when it's fine. Empty is allowed;
 *  pair with a required check when mandatory. */
export function validatePhone(
  phone: string,
  maxDigits = PHONE_MAX_DIGITS,
): string | null {
  const digits = phone.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length !== maxDigits) {
    return `Enter a ${maxDigits}-digit phone number.`;
  }
  return null;
}

/** Error string for a required text field, or null when present. */
export function validateRequired(value: string, label: string): string | null {
  return value.trim() ? null : `${label} is required.`;
}
