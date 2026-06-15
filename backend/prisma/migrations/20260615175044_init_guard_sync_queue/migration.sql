-- CreateTable
CREATE TABLE "GuardSyncQueue" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "guard_id" TEXT NOT NULL,
    "action_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "synced_at" TIMESTAMP(3),

    CONSTRAINT "GuardSyncQueue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GuardSyncQueue_tenant_id_idx" ON "GuardSyncQueue"("tenant_id");

-- CreateIndex
CREATE INDEX "GuardSyncQueue_guard_id_idx" ON "GuardSyncQueue"("guard_id");

-- CreateIndex
CREATE INDEX "GuardSyncQueue_status_idx" ON "GuardSyncQueue"("status");

-- AddForeignKey
ALTER TABLE "GuardSyncQueue" ADD CONSTRAINT "GuardSyncQueue_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuardSyncQueue" ADD CONSTRAINT "GuardSyncQueue_guard_id_fkey" FOREIGN KEY ("guard_id") REFERENCES "Guard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
