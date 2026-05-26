ALTER TABLE "Incident" DROP CONSTRAINT IF EXISTS "Incident_status_check";

UPDATE "Incident"
SET "status" = 'approved'
WHERE "status" = 'reviewed';

ALTER TABLE "Incident"
ADD COLUMN "reviewed_by" TEXT,
ADD COLUMN "reviewed_at" TIMESTAMP(3),
ADD COLUMN "review_note" TEXT;

ALTER TABLE "Incident"
ADD CONSTRAINT "Incident_status_check" CHECK ("status" IN ('submitted', 'under_review', 'approved', 'rejected'));

CREATE INDEX "Incident_reviewed_by_idx" ON "Incident"("reviewed_by");

ALTER TABLE "Incident"
ADD CONSTRAINT "Incident_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
