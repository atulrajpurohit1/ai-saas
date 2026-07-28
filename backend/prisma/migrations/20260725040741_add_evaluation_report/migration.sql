-- CreateTable
CREATE TABLE "EvaluationReport" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "rfp_id" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "recommended_vendor" TEXT,
    "overall_analysis" TEXT NOT NULL,
    "generated_report" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvaluationReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EvaluationReport_tenant_id_idx" ON "EvaluationReport"("tenant_id");

-- CreateIndex
CREATE INDEX "EvaluationReport_rfp_id_idx" ON "EvaluationReport"("rfp_id");

-- AddForeignKey
ALTER TABLE "EvaluationReport" ADD CONSTRAINT "EvaluationReport_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationReport" ADD CONSTRAINT "EvaluationReport_rfp_id_fkey" FOREIGN KEY ("rfp_id") REFERENCES "Rfp"("id") ON DELETE CASCADE ON UPDATE CASCADE;
