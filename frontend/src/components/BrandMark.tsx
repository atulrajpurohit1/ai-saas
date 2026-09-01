import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BrandMarkProps {
  /** Portal label shown under the wordmark (e.g. "Client Portal", "Guard Portal"). */
  subtitle?: string;
  size?: 'sm' | 'md' | 'lg';
  /** Render the wordmark text next to the icon. */
  showWordmark?: boolean;
  className?: string;
}

const iconSize = { sm: 18, md: 22, lg: 30 } as const;
const boxClass = {
  sm: 'h-8 w-8 rounded-lg',
  md: 'h-10 w-10 rounded-xl',
  lg: 'h-14 w-14 rounded-2xl',
} as const;
const wordClass = {
  sm: 'text-base',
  md: 'text-lg',
  lg: 'text-2xl',
} as const;

/**
 * The single AegisLead brand lockup. Used by the Admin/Client/Guard shells and
 * every auth screen so the product reads as one system. Admin keeps its
 * tenant-configurable logo via <Sidebar>; this is the static fallback lockup
 * used everywhere the tenant branding API is not available (Client / Guard /
 * pre-auth).
 */
export function BrandMark({
  subtitle,
  size = 'md',
  showWordmark = true,
  className,
}: BrandMarkProps) {
  return (
    <span className={cn('flex min-w-0 items-center gap-3', className)}>
      <span
        className={cn(
          'flex shrink-0 items-center justify-center bg-primary text-primary-foreground shadow-sm',
          boxClass[size],
        )}
      >
        <ShieldCheck size={iconSize[size]} />
      </span>
      {showWordmark && (
        <span className="min-w-0">
          <span className={cn('block font-extrabold tracking-tight text-foreground', wordClass[size])}>
            Aegis<span className="text-primary">Lead</span>
          </span>
          {subtitle && (
            <span className="block truncate text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {subtitle}
            </span>
          )}
        </span>
      )}
    </span>
  );
}

export default BrandMark;
