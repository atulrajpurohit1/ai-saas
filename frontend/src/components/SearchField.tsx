'use client';

import React from 'react';
import { Search } from 'lucide-react';
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
      <span className="text-xs font-bold uppercase tracking-widest text-slate-500">{label}</span>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
        <Input
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 pl-10"
        />
      </div>
    </label>
  );
}
