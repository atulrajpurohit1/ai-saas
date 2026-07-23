-- CreateEnum
CREATE TYPE "RfpStatus" AS ENUM ('DRAFT', 'GENERATED', 'FINALIZED');

-- CreateTable
CREATE TABLE "Rfp" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "client_name" TEXT NOT NULL,
    "company_name" TEXT,
    "industry" TEXT,
    "project_name" TEXT,
    "due_date" TIMESTAMP(3),
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "estimated_budget" DOUBLE PRECISION,
    "security_types" JSONB NOT NULL DEFAULT '[]',
    "number_of_locations" INTEGER,
    "address" TEXT,
    "operating_hours" TEXT,
    "guards_required" INTEGER,
    "additional_requirements" TEXT,
    "generated_content" TEXT,
    "status" "RfpStatus" NOT NULL DEFAULT 'DRAFT',
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Rfp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Rfp_tenant_id_idx" ON "Rfp"("tenant_id");

-- CreateIndex
CREATE INDEX "Rfp_tenant_id_status_idx" ON "Rfp"("tenant_id", "status");

-- AddForeignKey
ALTER TABLE "Rfp" ADD CONSTRAINT "Rfp_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
