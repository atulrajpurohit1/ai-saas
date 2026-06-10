-- AlterTable
ALTER TABLE "ApiKey" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "CustomDomain" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Role" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "SSOProvider" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "TenantBranding" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Webhook" ALTER COLUMN "updated_at" DROP DEFAULT;

-- CreateTable
CREATE TABLE "Checkpoint" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "location_note" TEXT,
    "qr_code_value" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Checkpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatrolRoute" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PatrolRoute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatrolRouteCheckpoint" (
    "id" TEXT NOT NULL,
    "patrol_route_id" TEXT NOT NULL,
    "checkpoint_id" TEXT NOT NULL,
    "sequence_order" INTEGER NOT NULL,

    CONSTRAINT "PatrolRouteCheckpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatrolRun" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "shift_id" TEXT NOT NULL,
    "guard_id" TEXT NOT NULL,
    "patrol_route_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'not_started',
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PatrolRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatrolEvent" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "patrol_run_id" TEXT NOT NULL,
    "checkpoint_id" TEXT NOT NULL,
    "guard_id" TEXT NOT NULL,
    "scanned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PatrolEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Checkpoint_tenant_id_idx" ON "Checkpoint"("tenant_id");

-- CreateIndex
CREATE INDEX "Checkpoint_site_id_idx" ON "Checkpoint"("site_id");

-- CreateIndex
CREATE INDEX "Checkpoint_status_idx" ON "Checkpoint"("status");

-- CreateIndex
CREATE INDEX "PatrolRoute_tenant_id_idx" ON "PatrolRoute"("tenant_id");

-- CreateIndex
CREATE INDEX "PatrolRoute_site_id_idx" ON "PatrolRoute"("site_id");

-- CreateIndex
CREATE INDEX "PatrolRoute_status_idx" ON "PatrolRoute"("status");

-- CreateIndex
CREATE INDEX "PatrolRouteCheckpoint_patrol_route_id_idx" ON "PatrolRouteCheckpoint"("patrol_route_id");

-- CreateIndex
CREATE INDEX "PatrolRouteCheckpoint_checkpoint_id_idx" ON "PatrolRouteCheckpoint"("checkpoint_id");

-- CreateIndex
CREATE UNIQUE INDEX "PatrolRouteCheckpoint_patrol_route_id_checkpoint_id_key" ON "PatrolRouteCheckpoint"("patrol_route_id", "checkpoint_id");

-- CreateIndex
CREATE INDEX "PatrolRun_tenant_id_idx" ON "PatrolRun"("tenant_id");

-- CreateIndex
CREATE INDEX "PatrolRun_shift_id_idx" ON "PatrolRun"("shift_id");

-- CreateIndex
CREATE INDEX "PatrolRun_guard_id_idx" ON "PatrolRun"("guard_id");

-- CreateIndex
CREATE INDEX "PatrolRun_patrol_route_id_idx" ON "PatrolRun"("patrol_route_id");

-- CreateIndex
CREATE INDEX "PatrolRun_status_idx" ON "PatrolRun"("status");

-- CreateIndex
CREATE INDEX "PatrolEvent_tenant_id_idx" ON "PatrolEvent"("tenant_id");

-- CreateIndex
CREATE INDEX "PatrolEvent_patrol_run_id_idx" ON "PatrolEvent"("patrol_run_id");

-- CreateIndex
CREATE INDEX "PatrolEvent_checkpoint_id_idx" ON "PatrolEvent"("checkpoint_id");

-- CreateIndex
CREATE INDEX "PatrolEvent_guard_id_idx" ON "PatrolEvent"("guard_id");

-- AddForeignKey
ALTER TABLE "Checkpoint" ADD CONSTRAINT "Checkpoint_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Checkpoint" ADD CONSTRAINT "Checkpoint_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatrolRoute" ADD CONSTRAINT "PatrolRoute_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatrolRoute" ADD CONSTRAINT "PatrolRoute_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatrolRouteCheckpoint" ADD CONSTRAINT "PatrolRouteCheckpoint_patrol_route_id_fkey" FOREIGN KEY ("patrol_route_id") REFERENCES "PatrolRoute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatrolRouteCheckpoint" ADD CONSTRAINT "PatrolRouteCheckpoint_checkpoint_id_fkey" FOREIGN KEY ("checkpoint_id") REFERENCES "Checkpoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatrolRun" ADD CONSTRAINT "PatrolRun_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatrolRun" ADD CONSTRAINT "PatrolRun_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "Shift"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatrolRun" ADD CONSTRAINT "PatrolRun_guard_id_fkey" FOREIGN KEY ("guard_id") REFERENCES "Guard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatrolRun" ADD CONSTRAINT "PatrolRun_patrol_route_id_fkey" FOREIGN KEY ("patrol_route_id") REFERENCES "PatrolRoute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatrolEvent" ADD CONSTRAINT "PatrolEvent_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatrolEvent" ADD CONSTRAINT "PatrolEvent_patrol_run_id_fkey" FOREIGN KEY ("patrol_run_id") REFERENCES "PatrolRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatrolEvent" ADD CONSTRAINT "PatrolEvent_checkpoint_id_fkey" FOREIGN KEY ("checkpoint_id") REFERENCES "Checkpoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatrolEvent" ADD CONSTRAINT "PatrolEvent_guard_id_fkey" FOREIGN KEY ("guard_id") REFERENCES "Guard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "AiGeneration_tenant_approval_status_idx" RENAME TO "AiGeneration_tenant_id_approval_status_idx";

-- RenameIndex
ALTER INDEX "AiGeneration_tenant_safety_status_idx" RENAME TO "AiGeneration_tenant_id_safety_status_idx";

-- RenameIndex
ALTER INDEX "ApiKey_tenant_status_idx" RENAME TO "ApiKey_tenant_id_status_idx";

-- RenameIndex
ALTER INDEX "ApiRequestLog_tenant_created_at_idx" RENAME TO "ApiRequestLog_tenant_id_created_at_idx";

-- RenameIndex
ALTER INDEX "Branch_tenant_status_idx" RENAME TO "Branch_tenant_id_status_idx";

-- RenameIndex
ALTER INDEX "CustomDomain_tenant_verification_status_idx" RENAME TO "CustomDomain_tenant_id_verification_status_idx";

-- RenameIndex
ALTER INDEX "PromptVersion_tenant_module_prompt_idx" RENAME TO "PromptVersion_tenant_id_module_name_prompt_key_idx";

-- RenameIndex
ALTER INDEX "PromptVersion_tenant_status_idx" RENAME TO "PromptVersion_tenant_id_status_idx";

-- RenameIndex
ALTER INDEX "RecommendationAction_tenant_id_target_module_target_entity_id_i" RENAME TO "RecommendationAction_tenant_id_target_module_target_entity__idx";

-- RenameIndex
ALTER INDEX "Role_tenant_active_idx" RENAME TO "Role_tenant_id_is_active_idx";

-- RenameIndex
ALTER INDEX "SSOProvider_tenant_provider_type_idx" RENAME TO "SSOProvider_tenant_id_provider_type_idx";

-- RenameIndex
ALTER INDEX "SSOProvider_tenant_status_idx" RENAME TO "SSOProvider_tenant_id_status_idx";

-- RenameIndex
ALTER INDEX "UserSession_tenant_status_idx" RENAME TO "UserSession_tenant_id_status_idx";

-- RenameIndex
ALTER INDEX "Webhook_tenant_event_type_idx" RENAME TO "Webhook_tenant_id_event_type_idx";

-- RenameIndex
ALTER INDEX "Webhook_tenant_status_idx" RENAME TO "Webhook_tenant_id_status_idx";
