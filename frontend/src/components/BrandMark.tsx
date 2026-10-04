import React from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { BRAND_LOGO, BRAND_NAME, BRAND_TAGLINE } from '@/lib/brand';

interface BrandMarkProps {
  /** Portal label shown under the wordmark (e.g. "Client Portal", "Guard Portal"). */
  subtitle?: string;
  size?: 'sm' | 'md' | 'lg';
  /** Render the wordmark text next to the icon. */
  showWordmark?: boolean;
  /**
   * `icon` pairs the square mark with live text (the default, and what the
   * portal shells use so `subtitle` can sit under it). `lockup` is the full
   * horizontal logo - mark, wordmark and tagline - for auth screens and the
   * admin sidebar.
   *
   * The lockup is composed here rather than loaded as one image: the supplied
   * lockup artwork was cropped, so we build it from the intact mark plus live
   * text instead of shipping a redrawn approximation. See `@/lib/brand`.
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

/** The tagline as it reads in the artwork: dark, with "Convert." in brand red. */
function Tagline({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <span
      className={cn(
        'block whitespace-nowrap font-semibold uppercase leading-none text-foreground/70',
        className,
      )}
      style={{ letterSpacing: '0.12em', ...style }}
    >
      Find Leads. <span className="text-foreground/25">|</span> Engage.{' '}
      <span className="text-foreground/25">|</span>{' '}
      <span className="text-primary">Convert.</span>{' '}
      <span className="text-foreground/25">|</span> Grow.
    </span>
  );
}

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
 * artwork is intrinsically square and only ever scaled uniformly. Asset paths
 * live in `@/lib/brand` so they are never hardcoded at call sites.
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
    // Proportions measured off the supplied artwork, where the full lockup is
    // ~455px wide: a 73px wordmark cap-height (~0.16 of the width), a ~20px
    // tagline (~0.045) and a square mark about the height of the two stacked.
    const markPx = Math.round(lockupWidth * 0.185);
    return (
      <span
        className={cn('flex min-w-0 items-center gap-[0.5em]', className)}
        // `width` is the design size; callers that pass a width class (e.g.
        // the sidebar's `w-full`) override it, and the children scale from
        // `lockupWidth` either way.
        style={{ maxWidth: lockupWidth }}
        aria-label={`${BRAND_NAME} — ${BRAND_TAGLINE}`}
        role="img"
      >
        <Image
          src={BRAND_LOGO.mark}
          alt=""
          width={markPx}
          height={markPx}
          priority
          className="shrink-0"
        />
        <span className="min-w-0">
          <span
            className="block font-extrabold leading-none tracking-tight text-foreground"
            style={{ fontSize: Math.round(lockupWidth * 0.148) }}
          >
            Aegis<span className="text-primary">Lead</span>
          </span>
          {/* Below ~190px the tagline can no longer render at a legible size
              without out-running the wordmark it is meant to sit under, so the
              lockup drops to mark + wordmark rather than overflowing. */}
          {lockupWidth >= 190 && (
            <Tagline
              className="mt-[0.35em]"
              style={{ fontSize: Math.round(lockupWidth * 0.0275) }}
            />
          )}
        </span>
      </span>
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
