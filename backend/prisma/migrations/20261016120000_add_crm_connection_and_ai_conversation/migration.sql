-- Reconciles the migration history with schema.prisma.
--
-- WHY THIS EXISTS
-- CrmConnection and AiConversation are models in schema.prisma, and
-- crm-connectors.service.ts queries CrmConnection -- but no migration ever
-- created either table. They were applied to the live database with
-- `prisma db push`, which writes the schema without recording a migration. The
-- consequence was that a database built from this repository came up MISSING a
-- table the application queries, so CRM connectors failed anywhere other than
-- the one database that had been pushed to. Conversely SCIMConfig and
-- User.is_active were created by old migrations but have since been removed
-- from schema.prisma, so a freshly built database carried two objects the
-- model no longer knows about.
--
-- Generated with `prisma migrate diff --from-migrations --to-schema-datamodel`,
-- which is the difference between "what the migrations build" and "what
-- schema.prisma describes".
--
-- WHY EVERY STATEMENT IS GUARDED
-- This has to be correct against two different starting points:
--   * a FRESH database built from the migrations, which HAS SCIMConfig and
--     User.is_active and LACKS both new tables;
--   * PRODUCTION, which was restored from a dump of the pushed schema, so it
--     already HAS CrmConnection and lacks the other three.
-- Unguarded, the generated SQL fails on production at `CREATE TABLE
-- "CrmConnection"` and at the DROPs. The IF EXISTS / IF NOT EXISTS guards let
-- one migration reach the same end state from either side, so `migrate deploy`
-- needs no manual baselining and no one has to remember a special case.

-- DropForeignKey
ALTER TABLE IF EXISTS "SCIMConfig" DROP CONSTRAINT IF EXISTS "SCIMConfig_tenant_id_fkey";

-- AlterTable: removed from schema.prisma; no code reads it.
ALTER TABLE "User" DROP COLUMN IF EXISTS "is_active";

-- DropTable: removed from schema.prisma; no code reads it.
DROP TABLE IF EXISTS "SCIMConfig";

-- CreateTable
CREATE TABLE IF NOT EXISTS "AiConversation" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "confidence_score" DOUBLE PRECISION NOT NULL,
    "sources_used" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "CrmConnection" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'connected',
    "access_token" TEXT NOT NULL,
    "refresh_token" TEXT,
    "token_expires_at" TIMESTAMP(3),
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "portal_id" TEXT,
    "external_account_name" TEXT,
    "last_sync_at" TIMESTAMP(3),
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AiConversation_tenant_id_idx" ON "AiConversation"("tenant_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AiConversation_tenant_id_user_id_idx" ON "AiConversation"("tenant_id", "user_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AiConversation_tenant_id_created_at_idx" ON "AiConversation"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CrmConnection_tenant_id_idx" ON "CrmConnection"("tenant_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CrmConnection_tenant_id_provider_idx" ON "CrmConnection"("tenant_id", "provider");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "CrmConnection_tenant_provider_key" ON "CrmConnection"("tenant_id", "provider");

-- AddForeignKey
-- Postgres has no ADD CONSTRAINT IF NOT EXISTS, so these are guarded by hand.
-- Production already carries both constraints from the pushed schema.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'AiConversation_tenant_id_fkey'
    ) THEN
        ALTER TABLE "AiConversation"
            ADD CONSTRAINT "AiConversation_tenant_id_fkey"
            FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id")
            ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'CrmConnection_tenant_id_fkey'
    ) THEN
        ALTER TABLE "CrmConnection"
            ADD CONSTRAINT "CrmConnection_tenant_id_fkey"
            FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
