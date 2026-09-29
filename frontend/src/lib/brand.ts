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
 * The supplied brand artwork, as delivered. These replaced hand-drawn SVG
 * approximations; do not redraw them. If a vector original ever arrives, swap
 * these files and update BRAND_LOGO_RATIO to match its intrinsic size.
 */
export const BRAND_LOGO = {
  /** Full horizontal lockup (wordmark + tagline), dark text for light backgrounds. */
  light: '/brand/aegislead-logo-light.png',
  /** Full horizontal lockup, white text for dark backgrounds. */
  dark: '/brand/aegislead-logo-dark.png',
  /** Square icon mark only - for collapsed rails, avatars and favicons. */
  mark: '/brand/aegislead-mark.png',
} as const;

/**
 * Intrinsic aspect ratios, so callers can size by width without distortion.
 * These are the artwork's real pixel dimensions: get them wrong and the logo
 * is stretched, since BrandMark derives height from width using these.
 */
export const BRAND_LOGO_RATIO = {
  /** Lockup artwork is 300x86. */
  lockup: 300 / 86,
  /** Mark artwork is 150x150. */
  mark: 1,
} as const;
