-- CreateEnum
CREATE TYPE "ProspectDiscoveryJobState" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'ABANDONED');

-- CreateTable
CREATE TABLE "ProspectDiscoveryJob" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "request" JSONB NOT NULL,
    "status" "ProspectDiscoveryJobState" NOT NULL DEFAULT 'PENDING',
    "completed_at" TIMESTAMP(3),
    "last_polled_at" TIMESTAMP(3),
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProspectDiscoveryJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProspectDiscoveryJob_status_created_at_idx" ON "ProspectDiscoveryJob"("status", "created_at");

-- CreateIndex
CREATE INDEX "ProspectDiscoveryJob_tenant_id_user_id_idx" ON "ProspectDiscoveryJob"("tenant_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "ProspectDiscoveryJob_tenant_id_job_id_key" ON "ProspectDiscoveryJob"("tenant_id", "job_id");

-- AddForeignKey
ALTER TABLE "ProspectDiscoveryJob" ADD CONSTRAINT "ProspectDiscoveryJob_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
