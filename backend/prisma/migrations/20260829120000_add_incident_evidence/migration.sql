-- Phase 3F: photo/video evidence attachments for security incidents.
-- New table only - no existing data touched.
CREATE TABLE "IncidentEvidence" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "incident_id" TEXT NOT NULL,
    "media_type" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "stored_file_name" TEXT NOT NULL,
    "file_size_bytes" INTEGER NOT NULL,
    "uploaded_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IncidentEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IncidentEvidence_tenant_id_idx" ON "IncidentEvidence"("tenant_id");

-- CreateIndex
CREATE INDEX "IncidentEvidence_incident_id_idx" ON "IncidentEvidence"("incident_id");

-- AddForeignKey
ALTER TABLE "IncidentEvidence" ADD CONSTRAINT "IncidentEvidence_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentEvidence" ADD CONSTRAINT "IncidentEvidence_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "Incident"("id") ON DELETE CASCADE ON UPDATE CASCADE;
