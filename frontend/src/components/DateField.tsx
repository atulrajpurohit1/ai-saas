'use client';

import React, { useEffect, useId, useRef, useState } from 'react';

interface DateFieldProps {
  /** ISO date (yyyy-mm-dd) or '' — the shape the backend expects. */
  value: string;
  /** Called with a valid ISO date (yyyy-mm-dd), or '' when cleared. */
  onChange: (iso: string) => void;
  className?: string;
  id?: string;
  required?: boolean;
  disabled?: boolean;
  'aria-invalid'?: boolean;
}

/**
 * A date input that displays and accepts dates as DD-MM-YYYY (matching the rest
 * of the dashboard) while storing the value as an ISO yyyy-mm-dd string, so
 * callers and the backend are unaffected. Native <input type="date"> was
 * rejected because its visible format is dictated by the browser/OS locale and
 * cannot be forced to DD-MM-YYYY.
 *
 * Typing is masked to digits with hyphens inserted automatically; paste of a
 * full DD-MM-YYYY value works too. Real calendar validity is checked (e.g.
 * 31-02-2026 is rejected) before onChange fires.
 */
export function isoToDisplay(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  if (!match) return '';
  return `${match[3]}-${match[2]}-${match[1]}`;
}

export function displayToIso(display: string): string | null {
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec((display || '').trim());
  if (!match) return null;
  const dd = Number(match[1]);
  const mm = Number(match[2]);
  const yyyy = Number(match[3]);
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  const date = new Date(Date.UTC(yyyy, mm - 1, dd));
  // Reject overflow dates like 31-02 that JS would roll forward.
  if (
    date.getUTCFullYear() !== yyyy ||
    date.getUTCMonth() !== mm - 1 ||
    date.getUTCDate() !== dd
  ) {
    return null;
  }
  return `${match[3]}-${match[2]}-${match[1]}`;
}

export default function DateField({
  value,
  onChange,
  className,
  id,
  required,
  disabled,
  'aria-invalid': ariaInvalid,
}: DateFieldProps) {
  const [text, setText] = useState(isoToDisplay(value));
  const [validationMessage, setValidationMessage] = useState('');
  const isFocused = useRef(false);
  const errorId = useId();

  // Keep the visible text in sync when the ISO value changes from outside
  // (e.g. editing an existing record, or a form reset).
  useEffect(() => {
    // Do not wipe an invalid value while the user is correcting it. The parent
    // receives an empty ISO value until the field becomes valid, but the typed
    // DD-MM-YYYY text and its error remain visible.
    if (!isFocused.current) {
      setText(isoToDisplay(value));
      setValidationMessage('');
    }
  }, [value]);

  const dateMessage = (formatted: string) => {
    if (!formatted) return '';
    const digits = formatted.replace(/\D/g, '');
    if (digits.length < 8) return 'Enter the full date as DD-MM-YYYY.';
    return displayToIso(formatted)
      ? ''
      : 'Enter a real date: day 01-31 and month 01-12.';
  };

  const handleChange = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 8);
    let formatted = digits;
    if (digits.length > 4) {
      formatted = `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4)}`;
    } else if (digits.length > 2) {
      formatted = `${digits.slice(0, 2)}-${digits.slice(2)}`;
    }
    setText(formatted);

    const message = dateMessage(formatted);
    setValidationMessage(message);

    if (!message) {
      const iso = displayToIso(formatted);
      onChange(iso ?? '');
      return;
    }

    // Never leave the previous valid date in form state when the field now
    // contains an incomplete or impossible date. This prevents a stale value
    // from being submitted while the visible input is invalid.
    if (formatted === '') {
      onChange('');
    }
    if (formatted !== '') onChange('');
  };

  return (
    <>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="DD-MM-YYYY"
        maxLength={10}
        className={className}
        value={text}
        onFocus={() => {
          isFocused.current = true;
        }}
        onBlur={() => {
          isFocused.current = false;
        }}
        onChange={(e) => handleChange(e.target.value)}
        required={required}
        disabled={disabled}
        aria-invalid={ariaInvalid || Boolean(validationMessage)}
        aria-describedby={validationMessage ? errorId : undefined}
      />
      {validationMessage && (
        <p id={errorId} className="mt-1 text-xs font-medium text-error" role="alert">
          {validationMessage}
        </p>
      )}
    </>
  );
}
