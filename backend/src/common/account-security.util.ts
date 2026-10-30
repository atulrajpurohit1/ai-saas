/**
 * Shared rules for where account-security codes and notices go, used by both
 * AuthService (login 2FA, password change) and AccountSecurityService. Kept as
 * pure functions in one place so the "recovery email is the second factor"
 * policy can never drift between the two.
 */

export interface SecurityContactUser {
  email: string;
  recoveryEmail: string | null;
  recoveryEmailVerified: boolean;
}

/**
 * Where a 2FA / sensitive-action code is sent: the verified recovery email
 * when one exists (a genuine second factor), otherwise the primary email.
 */
export function codeTargetEmail(user: SecurityContactUser): string {
  return user.recoveryEmailVerified && user.recoveryEmail
    ? user.recoveryEmail
    : user.email;
}

/**
 * Every address that should receive a security notification: the primary
 * email, plus the recovery email when it has been verified. De-duplicated in
 * case the two ever coincide.
 */
export function securityNotifyTargets(user: SecurityContactUser): string[] {
  const targets = [user.email];
  if (
    user.recoveryEmailVerified &&
    user.recoveryEmail &&
    user.recoveryEmail.toLowerCase() !== user.email.toLowerCase()
  ) {
    targets.push(user.recoveryEmail);
  }
  return targets;
}

/** Masks an email for display, e.g. "j***@gmail.com" (mirrors the frontend). */
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return email;
  const visible = local.slice(0, 1);
  return `${visible}${'*'.repeat(Math.max(local.length - 1, 3))}@${domain}`;
}
