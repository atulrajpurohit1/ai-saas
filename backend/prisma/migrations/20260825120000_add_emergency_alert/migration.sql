-- CreateTable
CREATE TABLE "EmergencyAlert" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "guard_id" TEXT NOT NULL,
    "branch_id" TEXT,
    "patrol_run_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "triggered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledged_at" TIMESTAMP(3),
    "resolved_at" TIMESTAMP(3),
    "acknowledged_by" TEXT,
    "resolved_by" TEXT,
    "notes" TEXT,
    "last_latitude" DOUBLE PRECISION,
    "last_longitude" DOUBLE PRECISION,
    "last_accuracy_meters" DOUBLE PRECISION,
    "location_captured_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmergencyAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmergencyAlert_tenant_id_idx" ON "EmergencyAlert"("tenant_id");

-- CreateIndex
CREATE INDEX "EmergencyAlert_guard_id_idx" ON "EmergencyAlert"("guard_id");

-- CreateIndex
CREATE INDEX "EmergencyAlert_branch_id_idx" ON "EmergencyAlert"("branch_id");

-- CreateIndex
CREATE INDEX "EmergencyAlert_patrol_run_id_idx" ON "EmergencyAlert"("patrol_run_id");

-- CreateIndex
CREATE INDEX "EmergencyAlert_status_idx" ON "EmergencyAlert"("status");

-- CreateIndex
CREATE INDEX "EmergencyAlert_acknowledged_by_idx" ON "EmergencyAlert"("acknowledged_by");

-- CreateIndex
CREATE INDEX "EmergencyAlert_resolved_by_idx" ON "EmergencyAlert"("resolved_by");

-- AddForeignKey
ALTER TABLE "EmergencyAlert" ADD CONSTRAINT "EmergencyAlert_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyAlert" ADD CONSTRAINT "EmergencyAlert_guard_id_fkey" FOREIGN KEY ("guard_id") REFERENCES "Guard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyAlert" ADD CONSTRAINT "EmergencyAlert_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyAlert" ADD CONSTRAINT "EmergencyAlert_patrol_run_id_fkey" FOREIGN KEY ("patrol_run_id") REFERENCES "PatrolRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyAlert" ADD CONSTRAINT "EmergencyAlert_acknowledged_by_fkey" FOREIGN KEY ("acknowledged_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyAlert" ADD CONSTRAINT "EmergencyAlert_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
