'use client';

import React from 'react';
import { CalendarDays } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface DateTimeFieldProps {
  label: string;
  /** Native control value: 'YYYY-MM-DDTHH:mm' for datetime, 'YYYY-MM-DD' for date. */
  value: string;
  onChange: (value: string) => void;
  mode?: 'datetime' | 'date';
  required?: boolean;
  disabled?: boolean;
  /** Native min/max, same format as `value`. */
  min?: string;
  max?: string;
  /** Shown in red under the field; also flags the input as invalid. */
  error?: string;
  id?: string;
  className?: string;
}

/**
 * A labelled date / date-time field.
 *
 * It still uses the browser's native picker (so the calendar and, where
 * supported, the clock are one tap away and there is no extra dependency), but
 * adds the two things the bare input was missing: a clear label, and a
 * human-readable echo of what is currently selected ("Fri, Oct 24, 2026,
 * 10:06 PM") underneath. The empty native control shows only a "mm/dd/yyyy"
 * mask, which testers found confusing; the readable line removes the doubt
 * about what was actually entered.
 */
export default function DateTimeField({
  label,
  value,
  onChange,
  mode = 'datetime',
  required,
  disabled,
  min,
  max,
  error,
  id,
  className,
}: DateTimeFieldProps) {
  const fieldId = id ?? `dt-${label.replace(/\s+/g, '-').toLowerCase()}`;

  const readable = React.useMemo(() => {
    if (!value) return '';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '';
    return parsed.toLocaleString([], {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      ...(mode === 'datetime'
        ? { hour: '2-digit', minute: '2-digit' }
        : {}),
    });
  }, [value, mode]);

  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={fieldId} className="text-sm font-medium text-muted-foreground">
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </label>
      <div className="relative">
        <Input
          id={fieldId}
          type={mode === 'datetime' ? 'datetime-local' : 'date'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          disabled={disabled}
          min={min}
          max={max}
          aria-invalid={error ? true : undefined}
          className="pr-9"
        />
        <CalendarDays
          size={16}
          aria-hidden="true"
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
      </div>
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : readable ? (
        <p className="text-xs text-muted-foreground">{readable}</p>
      ) : null}
    </div>
  );
}
