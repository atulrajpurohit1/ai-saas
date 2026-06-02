ALTER TABLE "RecommendationAction"
ADD COLUMN "ai_generation_id" TEXT;

CREATE TABLE "AiGeneration" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "prompt_version" TEXT NOT NULL,
    "model_used" TEXT NOT NULL,
    "source_module" TEXT NOT NULL,
    "generated_output" JSONB NOT NULL,
    "fallback_used" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'success',
    "error_message" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiGeneration_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AiGeneration_status_check" CHECK ("status" IN ('success', 'failed', 'fallback'))
);

CREATE TABLE "AiFeedback" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "ai_generation_id" TEXT NOT NULL,
    "recommendation_id" TEXT,
    "action_id" TEXT,
    "rating" INTEGER NOT NULL,
    "feedback_text" TEXT,
    "is_useful" BOOLEAN NOT NULL,
    "is_accurate" BOOLEAN NOT NULL,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiFeedback_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AiFeedback_rating_check" CHECK ("rating" >= 1 AND "rating" <= 5)
);

CREATE INDEX "RecommendationAction_ai_generation_id_idx" ON "RecommendationAction"("ai_generation_id");

CREATE INDEX "AiGeneration_tenant_id_idx" ON "AiGeneration"("tenant_id");
CREATE INDEX "AiGeneration_tenant_id_source_module_idx" ON "AiGeneration"("tenant_id", "source_module");
CREATE INDEX "AiGeneration_tenant_id_status_idx" ON "AiGeneration"("tenant_id", "status");
CREATE INDEX "AiGeneration_tenant_id_fallback_used_idx" ON "AiGeneration"("tenant_id", "fallback_used");
CREATE INDEX "AiGeneration_created_at_idx" ON "AiGeneration"("created_at");

CREATE INDEX "AiFeedback_tenant_id_idx" ON "AiFeedback"("tenant_id");
CREATE INDEX "AiFeedback_ai_generation_id_idx" ON "AiFeedback"("ai_generation_id");
CREATE INDEX "AiFeedback_recommendation_id_idx" ON "AiFeedback"("recommendation_id");
CREATE INDEX "AiFeedback_action_id_idx" ON "AiFeedback"("action_id");
CREATE INDEX "AiFeedback_tenant_id_created_at_idx" ON "AiFeedback"("tenant_id", "created_at");

ALTER TABLE "AiGeneration"
ADD CONSTRAINT "AiGeneration_tenant_id_fkey"
FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AiFeedback"
ADD CONSTRAINT "AiFeedback_tenant_id_fkey"
FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AiFeedback"
ADD CONSTRAINT "AiFeedback_ai_generation_id_fkey"
FOREIGN KEY ("ai_generation_id") REFERENCES "AiGeneration"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AiFeedback"
ADD CONSTRAINT "AiFeedback_action_id_fkey"
FOREIGN KEY ("action_id") REFERENCES "RecommendationAction"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RecommendationAction"
ADD CONSTRAINT "RecommendationAction_ai_generation_id_fkey"
FOREIGN KEY ("ai_generation_id") REFERENCES "AiGeneration"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
