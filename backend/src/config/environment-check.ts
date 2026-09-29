import { Logger } from '@nestjs/common';

/**
 * Boot-time configuration check.
 *
 * Without this, missing configuration surfaced as a runtime failure on the
 * first request that needed it -- so a deploy could come up "healthy" with
 * signup broken, or with security behaviour silently downgraded. A bad deploy
 * should fail at boot, loudly, with the name of what is missing.
 *
 * Note how much hangs on NODE_ENV: OTP logging, CORS origins, HSTS and the
 * mail-failure path all branch on it. A production deploy that forgets to set
 * NODE_ENV=production does not merely lose a micro-optimisation, it prints
 * every OTP into the logs in cleartext and accepts localhost CORS origins.
 * That is why an unset NODE_ENV is called out here rather than defaulted.
 */

export interface EnvironmentReport {
  fatal: string[];
  warnings: string[];
}

const MIN_SECRET_LENGTH = 32;

/** Values that appear in example files and must never reach a real deploy. */
const PLACEHOLDER_SECRETS = new Set([
  'secret',
  'changeme',
  'change-me',
  'your-secret',
  'your-secret-here',
  'jwt-secret',
  'local-crm-token-secret',
  'test',
  'dev',
]);

function isWeakSecret(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return (
    normalized.length < MIN_SECRET_LENGTH ||
    PLACEHOLDER_SECRETS.has(normalized)
  );
}

/**
 * Inspects `env` and reports what is fatal and what merely deserves a warning.
 * Pure, so it can be tested without touching process.env or exiting.
 */
export function checkEnvironment(
  env: NodeJS.ProcessEnv = process.env,
): EnvironmentReport {
  const fatal: string[] = [];
  const warnings: string[] = [];
  const isProduction = env.NODE_ENV === 'production';

  // Without these the process cannot serve a single authenticated request.
  for (const key of ['DATABASE_URL', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET']) {
    if (!env[key]?.trim()) {
      fatal.push(`${key} is not set.`);
    }
  }

  const accessSecret = env.JWT_ACCESS_SECRET?.trim();
  const refreshSecret = env.JWT_REFRESH_SECRET?.trim();

  // A refresh token that verifies against the access-token secret lets an
  // access token be replayed as a refresh token and vice versa.
  if (accessSecret && refreshSecret && accessSecret === refreshSecret) {
    const message =
      'JWT_ACCESS_SECRET and JWT_REFRESH_SECRET are identical; the two token types must not share a signing key.';
    if (isProduction) fatal.push(message);
    else warnings.push(message);
  }

  for (const key of [
    'JWT_ACCESS_SECRET',
    'JWT_REFRESH_SECRET',
    'CRM_TOKEN_SECRET',
  ]) {
    const value = env[key]?.trim();
    if (value && isWeakSecret(value)) {
      const message = `${key} is shorter than ${MIN_SECRET_LENGTH} characters or is a known placeholder value.`;
      if (isProduction) fatal.push(message);
      else warnings.push(message);
    }
  }

  if (!env.NODE_ENV) {
    warnings.push(
      'NODE_ENV is not set. OTP codes will be written to the logs in cleartext, localhost and preview CORS origins will be accepted, and HSTS will not be sent. Set NODE_ENV=production for a production deploy.',
    );
  }

  if (isProduction) {
    // Signup and password reset both depend on mail actually leaving the box.
    const hasMailProvider =
      env.BREVO_API_KEY?.trim() ||
      env.RESEND_API_KEY?.trim() ||
      env.SMTP_HOST?.trim();
    if (!hasMailProvider) {
      warnings.push(
        'No mail provider configured (BREVO_API_KEY, RESEND_API_KEY or SMTP_HOST). Signup and password reset will fail, because neither can complete without delivering a code.',
      );
    }

    if (!env.EMAIL_FROM?.trim()) {
      warnings.push(
        'EMAIL_FROM is not set. Providers reject sends from an unverified address, so verification emails may not be delivered.',
      );
    }

    if (!env.CRM_TOKEN_SECRET?.trim()) {
      warnings.push(
        'CRM_TOKEN_SECRET is not set; stored CRM OAuth tokens fall back to being encrypted under JWT_ACCESS_SECRET. Rotating that secret will make existing CRM connections undecryptable.',
      );
    }

    if (!env.CORS_ORIGINS?.trim() && !env.FRONTEND_URL?.trim()) {
      warnings.push(
        'Neither CORS_ORIGINS nor FRONTEND_URL is set; only the origins hard-coded in main.ts will be accepted.',
      );
    }
  }

  return { fatal, warnings };
}

/**
 * Runs the check and refuses to boot when something fatal is missing.
 * Warnings are logged and boot continues.
 */
export function assertEnvironment(env: NodeJS.ProcessEnv = process.env): void {
  const logger = new Logger('EnvironmentCheck');
  const { fatal, warnings } = checkEnvironment(env);

  for (const warning of warnings) {
    logger.warn(warning);
  }

  if (fatal.length > 0) {
    for (const problem of fatal) {
      logger.error(problem);
    }
    throw new Error(
      `Refusing to start: ${fatal.length} configuration problem(s) above must be fixed.`,
    );
  }
}
