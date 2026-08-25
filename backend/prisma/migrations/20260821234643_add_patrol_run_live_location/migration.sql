-- Phase 3B: live guard location tracking, tied to an active PatrolRun.
-- All columns are nullable and purely additive - existing PatrolRun rows
-- are unaffected. Stores only the LATEST known location per run (not a
-- history table), overwritten on every update.
ALTER TABLE "PatrolRun" ADD COLUMN IF NOT EXISTS "last_latitude" DOUBLE PRECISION;
ALTER TABLE "PatrolRun" ADD COLUMN IF NOT EXISTS "last_longitude" DOUBLE PRECISION;
ALTER TABLE "PatrolRun" ADD COLUMN IF NOT EXISTS "last_accuracy_meters" DOUBLE PRECISION;
ALTER TABLE "PatrolRun" ADD COLUMN IF NOT EXISTS "last_location_at" TIMESTAMP(3);
