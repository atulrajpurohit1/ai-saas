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
 * Derived from the supplied brand artwork. The app-icon tile was delivered
 * intact, so `mark` is its glyph lifted onto transparency and `icon` is the
 * tile itself; `badge` is the supplied circular lockup.
 *
 * There is deliberately no full horizontal lockup image: the only copy of it
 * we were given was cropped (both the triangle mark and the end of the
 * wordmark/tagline were cut off), so the lockup is composed at render time
 * from `mark` + live text instead of shipping a redrawn approximation. If the
 * uncropped original ever arrives, add it here and simplify <BrandMark>.
 */
export const BRAND_LOGO = {
  /** Icon glyph only, transparent background - pairs with text, any surface. */
  mark: '/brand/aegislead-mark.png',
  /** The app-icon tile (dark rounded square), for avatars and tiles. */
  icon: '/brand/aegislead-icon.png',
  /** Circular lockup badge - wordmark and tagline are baked in. */
  badge: '/brand/aegislead-badge.png',
} as const;

/**
 * Intrinsic aspect ratios, so callers can size by width without distortion.
 * These are the artwork's real pixel dimensions: get them wrong and the logo
 * is stretched.
 */
export const BRAND_LOGO_RATIO = {
  /** Mark, icon tile and badge artwork are all square. */
  mark: 1,
  icon: 1,
  badge: 1,
} as const;
