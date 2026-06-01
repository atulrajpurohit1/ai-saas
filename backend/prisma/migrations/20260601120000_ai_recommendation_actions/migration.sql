CREATE TABLE "RecommendationAction" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "recommendation_id" TEXT NOT NULL,
    "action_type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "target_module" TEXT NOT NULL,
    "target_entity_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approved_by" TEXT,
    "approved_at" TIMESTAMP(3),
    "executed_at" TIMESTAMP(3),
    "failure_reason" TEXT,

    CONSTRAINT "RecommendationAction_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "RecommendationAction_status_check" CHECK ("status" IN ('pending', 'approved', 'rejected', 'executed', 'failed')),
    CONSTRAINT "RecommendationAction_type_check" CHECK ("action_type" IN ('create_follow_up_task', 'notify_admin', 'flag_client_risk', 'flag_site_risk', 'suggest_guard_reassignment', 'create_invoice_followup'))
);

CREATE UNIQUE INDEX "RecommendationAction_tenant_recommendation_key" ON "RecommendationAction"("tenant_id", "recommendation_id");
CREATE INDEX "RecommendationAction_tenant_id_idx" ON "RecommendationAction"("tenant_id");
CREATE INDEX "RecommendationAction_tenant_id_status_idx" ON "RecommendationAction"("tenant_id", "status");
CREATE INDEX "RecommendationAction_tenant_id_target_module_target_entity_id_idx" ON "RecommendationAction"("tenant_id", "target_module", "target_entity_id");

ALTER TABLE "RecommendationAction"
ADD CONSTRAINT "RecommendationAction_tenant_id_fkey"
FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
