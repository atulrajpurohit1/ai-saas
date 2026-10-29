'use client';

import React from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/**
 * Labelled search box for the list-page filter bars.
 *
 * These sit in a grid beside BranchSelect, which carries a label above its
 * control. A bare input left the search column shorter than the row, and
 * because the icon centred on the stretched grid item rather than on the
 * input it drifted below the field. Matching BranchSelect's label + control
 * structure keeps both columns the same height, so the icon centres on the
 * input itself.
 */
export default function SearchField({
  value,
  onChange,
  placeholder = 'Search...',
  label = 'Search',
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  className?: string;
}) {
  return (
    <label className={cn('block space-y-1', className)}>
      <span className="text-eyebrow">{label}</span>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
        <Input
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && value) {
              e.preventDefault();
              onChange('');
            }
          }}
          className={cn('h-10 pl-10', value && 'pr-10')}
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground outline-none transition hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <X size={14} aria-hidden="true" />
          </button>
        )}
      </div>
    </label>
  );
}
