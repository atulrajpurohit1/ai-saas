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

export const BRAND_LOGO = {
  /** Full horizontal lockup (wordmark + tagline) for light backgrounds. */
  light: '/brand/aegislead-logo-light.svg',
  /** Full horizontal lockup for dark backgrounds. */
  dark: '/brand/aegislead-logo-dark.svg',
  /** Square icon mark only - for collapsed rails, avatars and favicons. */
  mark: '/brand/aegislead-mark.svg',
} as const;

/** Intrinsic aspect ratios, so callers can size by width without distortion. */
export const BRAND_LOGO_RATIO = {
  /** viewBox "0 0 700 200" */
  lockup: 700 / 200,
  /** viewBox "0 0 200 200" */
  mark: 1,
} as const;
