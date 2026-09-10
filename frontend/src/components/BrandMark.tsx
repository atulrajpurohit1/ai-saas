import React from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

interface BrandMarkProps {
  /** Portal label shown under the wordmark (e.g. "Client Portal", "Guard Portal"). */
  subtitle?: string;
  size?: 'sm' | 'md' | 'lg';
  /** Render the wordmark text next to the icon. */
  showWordmark?: boolean;
  className?: string;
}

const iconPx = { sm: 32, md: 40, lg: 56 } as const;
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
 *
 * Renders the official AegisLead mark (red triangular icon on a transparent
 * background) so it drops cleanly onto the light `bg-card`/`bg-background`
 * surfaces every portal shell uses - never stretched or cropped, since the
 * source SVG is intrinsically square and only ever scaled uniformly.
 */
export function BrandMark({
  subtitle,
  size = 'md',
  showWordmark = true,
  className,
}: BrandMarkProps) {
  const px = iconPx[size];
  return (
    <span className={cn('flex min-w-0 items-center gap-3', className)}>
      <Image
        src="/brand/aegislead-mark.svg"
        alt="AegisLead"
        width={px}
        height={px}
        className="shrink-0"
        priority
      />
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
