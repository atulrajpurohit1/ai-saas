/**
 * Marks a token as belonging to the platform console rather than a tenant.
 *
 * Carried in the `scope` claim and checked by the platform strategy. It is a
 * second lock, not the main one: platform tokens are signed with a different
 * secret, so a tenant token already fails verification before any claim is
 * read. The claim exists so that a future mistake -- someone reusing one
 * secret for both, say -- still cannot turn a tenant token into a platform
 * token by accident.
 */
export const PLATFORM_TOKEN_SCOPE = 'platform' as const;

/** Lockout policy for the platform login. */
export const PLATFORM_MAX_FAILED_ATTEMPTS = 5;
export const PLATFORM_LOCKOUT_MINUTES = 15;
