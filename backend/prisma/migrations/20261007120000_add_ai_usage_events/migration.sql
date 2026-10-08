-- Observation-only log of AI token usage and cost. Moves no balance and
-- blocks nothing; it exists so per-feature credit prices can be set from
-- measured cost rather than guessed.

-- CreateEnum
CREATE TYPE "AiFeature" AS ENUM (
  'DAILY_REPORT_SUMMARY',
  'SALES_ASSESSMENT',
  'DISCOVERY_GUIDE',
  'OUTREACH_PLAN',
  'DISCOVERY_CALL_INTELLIGENCE',
  'DISCOVERY_LIVE_COACH',
  'DISCOVERY_PROPOSAL',
  'PROPOSAL_DRAFT',
  'RFP_GENERATION',
  'EVALUATION_REPORT',
  'SECURITY_RFP_ANALYSIS',
  'PROPOSAL_FROM_RFP',
  'LEAD_GENERATION',
  'EMAIL_DRAFT',
  'NOTE_SUMMARY',
  'BUSINESS_INSIGHT_RECOMMENDATIONS',
  'INCIDENT_RISK_SUMMARY',
  'REVENUE_INTELLIGENCE_SUMMARY',
  'REVENUE_FINANCIAL_RECOMMENDATIONS',
  'GUARD_RECOMMENDATION_EXPLANATION',
  'COPILOT_ANSWER',
  'LEAD_EXTRACTION',
  'PROSPECT_COMPANY_INSIGHT',
  'OTHER'
);

-- CreateTable
CREATE TABLE "AiUsageEvent" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "user_id" TEXT,
    "feature" "AiFeature" NOT NULL,
    "model" TEXT NOT NULL,
    "input_tokens" INTEGER,
    "output_tokens" INTEGER,
    "total_tokens" INTEGER,
    "estimated_cost_usd" DECIMAL(12,8),
    "succeeded" BOOLEAN NOT NULL DEFAULT true,
    "duration_ms" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiUsageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiUsageEvent_tenant_id_created_at_idx" ON "AiUsageEvent"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "AiUsageEvent_feature_created_at_idx" ON "AiUsageEvent"("feature", "created_at");

-- CreateIndex
CREATE INDEX "AiUsageEvent_created_at_idx" ON "AiUsageEvent"("created_at");

-- AddForeignKey
-- SET NULL rather than CASCADE: a deleted tenant's spend still happened, and
-- deleting the evidence would understate historical cost.
ALTER TABLE "AiUsageEvent" ADD CONSTRAINT "AiUsageEvent_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
