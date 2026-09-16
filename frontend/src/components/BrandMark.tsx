import React from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { BRAND_LOGO, BRAND_LOGO_RATIO, BRAND_NAME, BRAND_TAGLINE } from '@/lib/brand';

interface BrandMarkProps {
  /** Portal label shown under the wordmark (e.g. "Client Portal", "Guard Portal"). */
  subtitle?: string;
  size?: 'sm' | 'md' | 'lg';
  /** Render the wordmark text next to the icon. */
  showWordmark?: boolean;
  /**
   * `icon` pairs the square mark with live text (the default, and what the
   * portal shells use so `subtitle` can sit under it). `lockup` renders the
   * full supplied horizontal logo artwork - icon, wordmark and tagline baked
   * into one SVG - for auth screens and the admin sidebar, where it should
   * match the brand asset exactly rather than be re-created in HTML.
   */
  variant?: 'icon' | 'lockup';
  /** Rendered width in px for `variant="lockup"`. Height follows the artwork. */
  lockupWidth?: number;
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
 * source SVG is intrinsically square and only ever scaled uniformly. Asset
 * paths live in `@/lib/brand` so they are never hardcoded at call sites.
 */
export function BrandMark({
  subtitle,
  size = 'md',
  showWordmark = true,
  variant = 'icon',
  lockupWidth = 240,
  className,
}: BrandMarkProps) {
  if (variant === 'lockup') {
    return (
      <Image
        src={BRAND_LOGO.light}
        alt={`${BRAND_NAME} — ${BRAND_TAGLINE}`}
        width={lockupWidth}
        height={Math.round(lockupWidth / BRAND_LOGO_RATIO.lockup)}
        priority
        className={cn('h-auto max-w-full object-contain', className)}
      />
    );
  }

  const px = iconPx[size];
  return (
    <span className={cn('flex min-w-0 items-center gap-3', className)}>
      <Image
        src={BRAND_LOGO.mark}
        alt={BRAND_NAME}
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
