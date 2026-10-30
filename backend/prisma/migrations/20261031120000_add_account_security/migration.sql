-- Adds per-user account-security fields: a verified recovery email (the true
-- second factor and extra notification target) and an email-based two-step
-- verification toggle. All default to "off" so every existing account keeps
-- password-only login and no recovery email until the owner opts in from
-- Settings -> Security. See User.recoveryEmail / twoFactorEnabled.
ALTER TABLE "User" ADD COLUMN "recovery_email" TEXT;
ALTER TABLE "User" ADD COLUMN "recovery_email_verified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "two_factor_enabled" BOOLEAN NOT NULL DEFAULT false;
