/**
 * Single source of truth for the AegisLead brand assets that ship with the app.
 *
 * These are the built-in product marks - they are NOT the same thing as a
 * tenant's uploaded `logo_url` from `getBranding()`. Tenant branding always
 * wins where it exists; these are the fallback so we never render a bare
 * text wordmark.
 */
export const BRAND_NAME = 'AegisLead';
export const BRAND_TAGLINE = 'Find Leads. Engage. Convert. Grow.';

/**
 * The supplied brand artwork, as delivered. These are the real files, cut out
 * onto transparency so they sit on any surface - do not redraw them. If a
 * vector original ever arrives, swap these files and update BRAND_LOGO_RATIO
 * to match its intrinsic size.
 */
export const BRAND_LOGO = {
  /** Full horizontal lockup (mark + wordmark + tagline), dark text for light backgrounds. */
  light: '/brand/aegislead-logo-light.png',
  /** The same lockup with the wordmark and tagline in white, for dark backgrounds. */
  dark: '/brand/aegislead-logo-dark.png',
  /** Icon glyph only, transparent background - pairs with live text, any surface. */
  mark: '/brand/aegislead-mark.png',
  /** The app-icon tile (dark rounded square), for avatars and tiles. */
  icon: '/brand/aegislead-icon.png',
  /** Circular lockup badge - wordmark and tagline are baked in. */
  badge: '/brand/aegislead-badge.png',
} as const;

/**
 * Intrinsic aspect ratios, so callers can size by width without distortion.
 * These are the artwork's real pixel dimensions: get them wrong and the logo
 * is stretched, since BrandMark derives height from width using these.
 */
export const BRAND_LOGO_RATIO = {
  /** Lockup artwork is 1200x271. */
  lockup: 1200 / 271,
  /** Mark, icon tile and badge artwork are all square. */
  mark: 1,
  icon: 1,
  badge: 1,
} as const;
