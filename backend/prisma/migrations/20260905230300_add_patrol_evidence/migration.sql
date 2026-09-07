-- Phase 3H: photo evidence a guard captures during a Guard Tour checkpoint scan.
-- New table only - no existing patrol data is touched or migrated.
CREATE TABLE "PatrolEvidence" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "patrol_event_id" TEXT NOT NULL,
    "patrol_run_id" TEXT NOT NULL,
    "guard_id" TEXT NOT NULL,
    "media_type" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "stored_file_name" TEXT NOT NULL,
    "file_size_bytes" INTEGER NOT NULL,
    "uploaded_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PatrolEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PatrolEvidence_tenant_id_idx" ON "PatrolEvidence"("tenant_id");

-- CreateIndex
CREATE INDEX "PatrolEvidence_patrol_event_id_idx" ON "PatrolEvidence"("patrol_event_id");

-- CreateIndex
CREATE INDEX "PatrolEvidence_patrol_run_id_idx" ON "PatrolEvidence"("patrol_run_id");

-- AddForeignKey
ALTER TABLE "PatrolEvidence" ADD CONSTRAINT "PatrolEvidence_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatrolEvidence" ADD CONSTRAINT "PatrolEvidence_patrol_event_id_fkey" FOREIGN KEY ("patrol_event_id") REFERENCES "PatrolEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
