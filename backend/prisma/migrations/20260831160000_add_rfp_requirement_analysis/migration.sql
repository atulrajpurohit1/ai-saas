-- Phase 3H: AI-extracted, security-specific RFP requirement analysis.
-- New table only - no existing data touched.
CREATE TABLE "RfpRequirementAnalysis" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "rfp_id" TEXT NOT NULL,
    "requirements" JSONB NOT NULL DEFAULT '[]',
    "summary" TEXT NOT NULL,
    "missing_information" JSONB NOT NULL DEFAULT '[]',
    "model_used" TEXT NOT NULL,
    "fallback_used" BOOLEAN NOT NULL DEFAULT false,
    "safety_status" TEXT NOT NULL DEFAULT 'passed',
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RfpRequirementAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RfpRequirementAnalysis_tenant_id_idx" ON "RfpRequirementAnalysis"("tenant_id");

-- CreateIndex
CREATE INDEX "RfpRequirementAnalysis_rfp_id_idx" ON "RfpRequirementAnalysis"("rfp_id");

-- AddForeignKey
ALTER TABLE "RfpRequirementAnalysis" ADD CONSTRAINT "RfpRequirementAnalysis_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfpRequirementAnalysis" ADD CONSTRAINT "RfpRequirementAnalysis_rfp_id_fkey" FOREIGN KEY ("rfp_id") REFERENCES "Rfp"("id") ON DELETE CASCADE ON UPDATE CASCADE;
