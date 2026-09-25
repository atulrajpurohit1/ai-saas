-- CreateEnum
CREATE TYPE "ReportEmailMode" AS ENUM ('MANUAL', 'AUTOMATIC');

-- AlterTable
-- Defaults are deliberately off/MANUAL: existing clients must not suddenly
-- start receiving emails they never asked for.
ALTER TABLE "Client"
  ADD COLUMN "report_email_enabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "report_email_mode" "ReportEmailMode" NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN "report_email_cc" TEXT;
