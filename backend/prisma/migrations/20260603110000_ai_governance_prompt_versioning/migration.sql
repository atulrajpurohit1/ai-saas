-- Phase 8: AI governance, prompt versioning, and output safety controls.

CREATE TABLE "PromptVersion" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "module_name" TEXT NOT NULL,
  "prompt_key" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "prompt_text" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'inactive',
  "created_by" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PromptVersion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PromptVersion_tenant_module_key_version_key"
  ON "PromptVersion"("tenant_id", "module_name", "prompt_key", "version");

CREATE UNIQUE INDEX "PromptVersion_active_prompt_key"
  ON "PromptVersion"("tenant_id", "module_name", "prompt_key")
  WHERE "status" = 'active';

CREATE INDEX "PromptVersion_tenant_id_idx"
  ON "PromptVersion"("tenant_id");

CREATE INDEX "PromptVersion_tenant_module_prompt_idx"
  ON "PromptVersion"("tenant_id", "module_name", "prompt_key");

CREATE INDEX "PromptVersion_tenant_status_idx"
  ON "PromptVersion"("tenant_id", "status");

ALTER TABLE "PromptVersion"
  ADD CONSTRAINT "PromptVersion_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AiGeneration"
  ADD COLUMN "prompt_version_id" TEXT,
  ADD COLUMN "input_source" JSONB,
  ADD COLUMN "client_visible" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "approval_status" TEXT NOT NULL DEFAULT 'not_required',
  ADD COLUMN "approved_by" TEXT,
  ADD COLUMN "approved_at" TIMESTAMP(3),
  ADD COLUMN "safety_status" TEXT NOT NULL DEFAULT 'passed',
  ADD COLUMN "safety_findings" JSONB;

CREATE INDEX "AiGeneration_prompt_version_id_idx"
  ON "AiGeneration"("prompt_version_id");

CREATE INDEX "AiGeneration_tenant_approval_status_idx"
  ON "AiGeneration"("tenant_id", "approval_status");

CREATE INDEX "AiGeneration_tenant_safety_status_idx"
  ON "AiGeneration"("tenant_id", "safety_status");

ALTER TABLE "AiGeneration"
  ADD CONSTRAINT "AiGeneration_prompt_version_id_fkey"
  FOREIGN KEY ("prompt_version_id") REFERENCES "PromptVersion"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

