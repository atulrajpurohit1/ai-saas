// Shared helpers for turning raw backend values (snake_case/UPPER_CASE enums,
// "unknown" placeholder strings) into presentable UI text. Use these instead
// of ad hoc `.replace('_', ' ')` calls or rendering raw enum/placeholder
// values directly.

export function formatEnumLabel(value?: string | null): string {
  if (!value) return '';
  return value
    .replace(/[_-]+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

// True for values that carry no real information for the user
// (missing, empty, or a literal "unknown"/"n/a" placeholder from the backend).
export function isUnknownValue(value?: string | number | null): boolean {
  if (value === null || value === undefined) return true;
  const normalized = String(value).trim().toLowerCase();
  return normalized === '' || normalized === 'unknown' || normalized === 'n/a';
}

// Lightweight phone formatting/validation — not a full i18n phone library,
// just enough to stop unformatted raw digit strings (e.g. "76383541975")
// from being saved and displayed as-is.
export function formatPhoneNumber(raw: string): string {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, '');

  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return trimmed;
}

// Accepts anything in a plausible international phone-number digit range
// (7-15 digits, per ITU E.164) so legitimate non-US numbers aren't rejected.
// An empty value is considered valid since these fields are optional.
export function isValidPhoneNumber(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return true;
  const digits = trimmed.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15;
}
