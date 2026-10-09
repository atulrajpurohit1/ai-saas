-- Lets a guard be marked as having left without deleting their history
-- (shifts, incidents, timesheets, invoices all reference the row). Null means
-- active. Billing counts a deactivated guard for the rest of the calendar
-- month they left in, then stops.
ALTER TABLE "Guard" ADD COLUMN IF NOT EXISTS "deactivated_at" TIMESTAMP(3);

-- Offline-sync actions that fail with a transient error are retried on the
-- guard's next sync, up to a cap, instead of being dropped.
ALTER TABLE "GuardSyncQueue" ADD COLUMN IF NOT EXISTS "retry_count" INTEGER NOT NULL DEFAULT 0;
-- Lets a row left 'pending' by a crashed request be picked up again later.
ALTER TABLE "GuardSyncQueue" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Additive and idempotent.
