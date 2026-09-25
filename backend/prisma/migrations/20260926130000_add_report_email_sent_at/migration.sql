-- AlterTable
ALTER TABLE "DailyServiceReport" ADD COLUMN "email_sent_at" TIMESTAMP(3);

-- Existing published reports are treated as already delivered. Without this,
-- the first automatic sweep would email clients a backlog of old reports.
UPDATE "DailyServiceReport"
SET "email_sent_at" = "published_at"
WHERE "status" = 'published' AND "published_at" IS NOT NULL;
