-- QR checkpoint-identity verification for Guard Tour checkpoint scans.
-- Purely additive and nullable: existing PatrolEvent rows are unaffected and
-- read back as "not QR-verified", and checkpoints with no qr_code_value
-- configured continue to scan exactly as before (NO_QR_CONFIGURED).
ALTER TABLE "PatrolEvent" ADD COLUMN IF NOT EXISTS "qr_verification_status" TEXT;
ALTER TABLE "PatrolEvent" ADD COLUMN IF NOT EXISTS "submitted_qr_value" TEXT;
