-- Audio recorded in the browser while a rep is on a call dialed from Sales
-- Calls. All nullable: every existing call was logged without a recording,
-- and a rep who denies microphone access still gets their dial logged.
ALTER TABLE "CallRecord" ADD COLUMN "recording_file_name" TEXT;
ALTER TABLE "CallRecord" ADD COLUMN "recording_stored_file_name" TEXT;
ALTER TABLE "CallRecord" ADD COLUMN "recording_mime_type" TEXT;
ALTER TABLE "CallRecord" ADD COLUMN "recording_size_bytes" INTEGER;
ALTER TABLE "CallRecord" ADD COLUMN "recording_duration_sec" INTEGER;
ALTER TABLE "CallRecord" ADD COLUMN "recorded_at" TIMESTAMP(3);
