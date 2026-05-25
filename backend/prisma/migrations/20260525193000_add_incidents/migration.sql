-- CreateTable
CREATE TABLE "Incident" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "shift_id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "guard_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'low',
    "status" TEXT NOT NULL DEFAULT 'submitted',
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "attachment_url" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Incident_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Incident_severity_check" CHECK ("severity" IN ('low', 'medium', 'high', 'critical')),
    CONSTRAINT "Incident_status_check" CHECK ("status" IN ('submitted', 'reviewed', 'rejected'))
);

-- CreateIndex
CREATE INDEX "Incident_tenant_id_idx" ON "Incident"("tenant_id");

-- CreateIndex
CREATE INDEX "Incident_shift_id_idx" ON "Incident"("shift_id");

-- CreateIndex
CREATE INDEX "Incident_site_id_idx" ON "Incident"("site_id");

-- CreateIndex
CREATE INDEX "Incident_guard_id_idx" ON "Incident"("guard_id");

-- CreateIndex
CREATE INDEX "Incident_severity_idx" ON "Incident"("severity");

-- CreateIndex
CREATE INDEX "Incident_status_idx" ON "Incident"("status");

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "Shift"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_guard_id_fkey" FOREIGN KEY ("guard_id") REFERENCES "Guard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
