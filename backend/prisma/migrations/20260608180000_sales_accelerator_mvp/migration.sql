-- CreateTable
CREATE TABLE "DiscoverySession" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "lead_id" TEXT,
    "deal_id" TEXT,
    "property_type" TEXT,
    "buyer_role" TEXT,
    "current_provider" TEXT,
    "guard_count" INTEGER,
    "service_hours" TEXT,
    "pain_points" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "risk_concerns" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "decision_timeline" TEXT,
    "budget_sensitivity" TEXT,
    "objections" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscoverySession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesAssessment" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "lead_id" TEXT,
    "deal_id" TEXT,
    "discovery_session_id" TEXT,
    "assessment_type" TEXT NOT NULL DEFAULT 'sales_assessment',
    "lead_score" INTEGER,
    "priority_tier" TEXT,
    "close_readiness_score" INTEGER,
    "discovery_quality_score" INTEGER,
    "risk_profile" TEXT,
    "proposal_angle" TEXT,
    "recommended_next_action" TEXT,
    "missing_questions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "objection_risks" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "summary" TEXT,
    "generated_output" JSONB,
    "ai_generation_id" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DiscoverySession_tenant_id_idx" ON "DiscoverySession"("tenant_id");

-- CreateIndex
CREATE INDEX "DiscoverySession_lead_id_idx" ON "DiscoverySession"("lead_id");

-- CreateIndex
CREATE INDEX "DiscoverySession_deal_id_idx" ON "DiscoverySession"("deal_id");

-- CreateIndex
CREATE INDEX "DiscoverySession_tenant_id_lead_id_idx" ON "DiscoverySession"("tenant_id", "lead_id");

-- CreateIndex
CREATE INDEX "DiscoverySession_tenant_id_deal_id_idx" ON "DiscoverySession"("tenant_id", "deal_id");

-- CreateIndex
CREATE INDEX "SalesAssessment_tenant_id_idx" ON "SalesAssessment"("tenant_id");

-- CreateIndex
CREATE INDEX "SalesAssessment_lead_id_idx" ON "SalesAssessment"("lead_id");

-- CreateIndex
CREATE INDEX "SalesAssessment_deal_id_idx" ON "SalesAssessment"("deal_id");

-- CreateIndex
CREATE INDEX "SalesAssessment_discovery_session_id_idx" ON "SalesAssessment"("discovery_session_id");

-- CreateIndex
CREATE INDEX "SalesAssessment_tenant_id_assessment_type_idx" ON "SalesAssessment"("tenant_id", "assessment_type");

-- CreateIndex
CREATE INDEX "SalesAssessment_tenant_id_created_at_idx" ON "SalesAssessment"("tenant_id", "created_at");

-- AddForeignKey
ALTER TABLE "DiscoverySession" ADD CONSTRAINT "DiscoverySession_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscoverySession" ADD CONSTRAINT "DiscoverySession_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscoverySession" ADD CONSTRAINT "DiscoverySession_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesAssessment" ADD CONSTRAINT "SalesAssessment_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesAssessment" ADD CONSTRAINT "SalesAssessment_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesAssessment" ADD CONSTRAINT "SalesAssessment_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesAssessment" ADD CONSTRAINT "SalesAssessment_discovery_session_id_fkey" FOREIGN KEY ("discovery_session_id") REFERENCES "DiscoverySession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
