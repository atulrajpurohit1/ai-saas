-- CreateEnum
CREATE TYPE "ServiceModule" AS ENUM ('LEAD_GEN', 'GUARD_TOUR', 'FINANCE');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED');

-- CreateTable
CREATE TABLE "TenantSubscription" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "trial_ends_at" TIMESTAMP(3),
    "current_period_end" TIMESTAMP(3),
    "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
    "provider_customer_id" TEXT,
    "provider_subscription_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantModule" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "module" "ServiceModule" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantModule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TenantSubscription_tenant_id_key" ON "TenantSubscription"("tenant_id");
CREATE UNIQUE INDEX "TenantSubscription_provider_subscription_id_key" ON "TenantSubscription"("provider_subscription_id");
CREATE INDEX "TenantSubscription_tenant_id_idx" ON "TenantSubscription"("tenant_id");
CREATE INDEX "TenantSubscription_status_idx" ON "TenantSubscription"("status");
CREATE INDEX "TenantModule_tenant_id_idx" ON "TenantModule"("tenant_id");
CREATE UNIQUE INDEX "TenantModule_tenant_id_module_key" ON "TenantModule"("tenant_id", "module");

-- AddForeignKey
ALTER TABLE "TenantSubscription" ADD CONSTRAINT "TenantSubscription_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TenantModule" ADD CONSTRAINT "TenantModule_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: every EXISTING tenant keeps full access to all three services.
-- Without this, shipping the ModuleGuard would instantly lock every current
-- customer out of everything. New tenants get modules from checkout instead.
INSERT INTO "TenantSubscription" ("id", "tenant_id", "status", "created_at", "updated_at")
SELECT gen_random_uuid()::text, "id", 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Tenant"
ON CONFLICT ("tenant_id") DO NOTHING;

INSERT INTO "TenantModule" ("id", "tenant_id", "module", "is_active", "created_at", "updated_at")
SELECT gen_random_uuid()::text, t."id", m."module", true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Tenant" t
CROSS JOIN (
    SELECT unnest(ARRAY['LEAD_GEN', 'GUARD_TOUR', 'FINANCE']::"ServiceModule"[]) AS "module"
) m
ON CONFLICT ("tenant_id", "module") DO NOTHING;
