-- Phase 3C: guard compliance/license/COI tracking.
-- New table only - no existing data touched.
CREATE TABLE "GuardCompliance" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "guard_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "document_number" TEXT,
    "issuing_authority" TEXT,
    "issue_date" TIMESTAMP(3),
    "expiration_date" TIMESTAMP(3),
    "notes" TEXT,
    "file_name" TEXT,
    "stored_file_name" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuardCompliance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GuardCompliance_tenant_id_idx" ON "GuardCompliance"("tenant_id");

-- CreateIndex
CREATE INDEX "GuardCompliance_guard_id_idx" ON "GuardCompliance"("guard_id");

-- CreateIndex
CREATE INDEX "GuardCompliance_type_idx" ON "GuardCompliance"("type");

-- CreateIndex
CREATE INDEX "GuardCompliance_expiration_date_idx" ON "GuardCompliance"("expiration_date");

-- AddForeignKey
ALTER TABLE "GuardCompliance" ADD CONSTRAINT "GuardCompliance_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuardCompliance" ADD CONSTRAINT "GuardCompliance_guard_id_fkey" FOREIGN KEY ("guard_id") REFERENCES "Guard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
