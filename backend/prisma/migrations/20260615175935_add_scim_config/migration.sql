-- AlterTable
ALTER TABLE "User" ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "SCIMConfig" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "provider_name" TEXT NOT NULL,
    "bearer_token" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SCIMConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SCIMConfig_bearer_token_key" ON "SCIMConfig"("bearer_token");

-- CreateIndex
CREATE INDEX "SCIMConfig_tenant_id_idx" ON "SCIMConfig"("tenant_id");

-- CreateIndex
CREATE INDEX "SCIMConfig_bearer_token_idx" ON "SCIMConfig"("bearer_token");

-- AddForeignKey
ALTER TABLE "SCIMConfig" ADD CONSTRAINT "SCIMConfig_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
