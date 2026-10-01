/**
 * One place for how passwords are constrained and hashed, so the admin
 * portal, the client portal, guards and admin-created accounts cannot drift
 * apart on it.
 */

export const PASSWORD_MIN_LENGTH = 8;

/**
 * bcrypt hashes at most the first 72 BYTES of input and silently discards the
 * rest. Without an explicit cap, a user who sets a long passphrase gets a
 * password that is quietly weaker than the one they typed, and two different
 * passphrases sharing a 72-byte prefix both unlock the account. Rejecting the
 * input is honest; truncating it is not.
 */
export const PASSWORD_MAX_LENGTH = 72;

/**
 * Cost factor for hashing PASSWORDS. 12 rather than 10: each step doubles the
 * work an offline cracker must do per guess, and 12 is the current common
 * baseline. The cost is paid only on login/registration/reset, where ~250ms
 * is not noticeable.
 */
export const BCRYPT_PASSWORD_ROUNDS = 12;

/**
 * Cost factor for hashing REFRESH TOKENS, deliberately left at 10.
 *
 * A refresh token is a 256-bit-entropy random string, not a human-chosen
 * secret: it cannot be guessed or dictionary-attacked, so a higher bcrypt
 * cost buys no meaningful resistance. It would, however, be paid on every
 * token refresh for every active session -- real latency for no security
 * gain. The reason these two numbers differ is the entropy of what is being
 * hashed, not an oversight.
 */
export const BCRYPT_TOKEN_ROUNDS = 10;

/**
 * A real bcrypt hash of a value nobody can supply, compared against when a
 * login names an email that has no account. Its only job is to make the
 * "unknown email" path cost the same as the "wrong password" path, so the
 * response time does not reveal which accounts exist.
 *
 * Generated at BCRYPT_PASSWORD_ROUNDS so the work matches a real comparison.
 * It is not a secret and never unlocks anything -- the plaintext behind it is
 * random and was discarded.
 */
export const DUMMY_PASSWORD_HASH =
  '$2b$12$x9qo26oPb8FfnMnLbpidJei0XHlQvt1Zu0.fPBAEnDgVvVfs49smq';
