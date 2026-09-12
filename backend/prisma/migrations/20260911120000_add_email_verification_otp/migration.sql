-- Email validation + OTP verification for signup (admin + client portal).
-- Additive and idempotent: adds nullable/defaulted verification columns to
-- User and ClientUser, and a new dedicated EmailOtp table. Does not touch or
-- drop any existing column, table, or data.

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "EmailOtpAccountType" AS ENUM ('USER', 'CLIENT_USER');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable: User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "email_verified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "email_verified_at" TIMESTAMP(3);

-- AlterTable: ClientUser
ALTER TABLE "ClientUser" ADD COLUMN IF NOT EXISTS "email_verified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ClientUser" ADD COLUMN IF NOT EXISTS "email_verified_at" TIMESTAMP(3);

-- Backfill: accounts created before this migration are treated as already
-- verified so existing users are never locked out of login retroactively.
UPDATE "User" SET "email_verified" = true, "email_verified_at" = "createdAt" WHERE "email_verified" = false;
UPDATE "ClientUser" SET "email_verified" = true, "email_verified_at" = "createdAt" WHERE "email_verified" = false;

-- CreateTable: EmailOtp
CREATE TABLE IF NOT EXISTS "EmailOtp" (
    "id" TEXT NOT NULL,
    "account_type" "EmailOtpAccountType" NOT NULL,
    "account_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT 'SIGNUP_VERIFICATION',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 5,
    "consumed_at" TIMESTAMP(3),
    "last_sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "send_count" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailOtp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "EmailOtp_account_purpose_key" ON "EmailOtp"("account_type", "account_id", "purpose");
CREATE INDEX IF NOT EXISTS "EmailOtp_email_idx" ON "EmailOtp"("email");
