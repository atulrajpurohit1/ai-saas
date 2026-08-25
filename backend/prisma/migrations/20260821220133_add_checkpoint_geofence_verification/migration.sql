-- Phase 3A: GPS geofence verification for patrol checkpoints.
-- All columns are nullable and purely additive - existing Checkpoint and
-- PatrolEvent rows are unaffected, and checkpoints without GPS configured
-- continue to work (NO_GEOFENCE_CONFIGURED at scan time).
ALTER TABLE "Checkpoint" ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION;
ALTER TABLE "Checkpoint" ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION;
ALTER TABLE "Checkpoint" ADD COLUMN IF NOT EXISTS "geofence_radius_meters" INTEGER;

ALTER TABLE "PatrolEvent" ADD COLUMN IF NOT EXISTS "verification_status" TEXT;
ALTER TABLE "PatrolEvent" ADD COLUMN IF NOT EXISTS "distance_meters" DOUBLE PRECISION;
ALTER TABLE "PatrolEvent" ADD COLUMN IF NOT EXISTS "submitted_latitude" DOUBLE PRECISION;
ALTER TABLE "PatrolEvent" ADD COLUMN IF NOT EXISTS "submitted_longitude" DOUBLE PRECISION;
