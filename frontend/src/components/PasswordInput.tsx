'use client';

import React, { useId, useState } from 'react';
import { Eye, EyeOff, LucideIcon } from 'lucide-react';

interface PasswordInputProps {
  value: string;
  onChange: (value: string) => void;
  className: string;
  iconClassName: string;
  icon: LucideIcon;
  iconSize?: number;
  placeholder?: string;
  required?: boolean;
  autoComplete?: string;
  id?: string;
}

/**
 * Password field with a show/hide toggle, styled to match the existing
 * AegisLead auth inputs (icon on the left, border/radius/typography from
 * the caller's `className`). Purely a display toggle — it does not touch
 * validation, auth requests, or form submission.
 */
export default function PasswordInput({
  value,
  onChange,
  className,
  iconClassName,
  icon: Icon,
  iconSize = 17,
  placeholder,
  required,
  autoComplete,
  id,
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
    <div className="relative">
      <Icon className={iconClassName} size={iconSize} />
      <input
        id={inputId}
        type={visible ? 'text' : 'password'}
        className={`${className} pr-11`}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        autoComplete={autoComplete}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
        aria-controls={inputId}
        tabIndex={0}
        className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-[var(--radius-sm)] text-muted-foreground transition hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        {visible ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}
