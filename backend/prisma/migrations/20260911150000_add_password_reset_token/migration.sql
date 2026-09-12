-- Forgot-password flow: short-lived, single-use, single-purpose reset token
-- issued after a PASSWORD_RESET-purpose EmailOtp is verified (see
-- AuthService.verifyResetOtp). Additive and idempotent: creates one new
-- table only, does not touch any existing column, table, or data. Reuses
-- the existing EmailOtp table for OTP generation/hashing/expiry/attempt
-- limiting (purpose = 'PASSWORD_RESET') — no changes needed there.

-- CreateTable: PasswordResetToken
CREATE TABLE IF NOT EXISTS "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PasswordResetToken_token_hash_key" ON "PasswordResetToken"("token_hash");
CREATE INDEX IF NOT EXISTS "PasswordResetToken_account_id_idx" ON "PasswordResetToken"("account_id");
CREATE INDEX IF NOT EXISTS "PasswordResetToken_expires_at_idx" ON "PasswordResetToken"("expires_at");
