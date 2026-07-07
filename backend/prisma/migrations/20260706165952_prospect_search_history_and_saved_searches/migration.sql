-- CreateTable
CREATE TABLE "ProspectSearchHistory" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "filters" JSONB NOT NULL,
    "provider" TEXT NOT NULL,
    "result_count" INTEGER NOT NULL,
    "searched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProspectSearchHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedProspectSearch" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "filters" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedProspectSearch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProspectSearchHistory_tenant_id_idx" ON "ProspectSearchHistory"("tenant_id");

-- CreateIndex
CREATE INDEX "ProspectSearchHistory_tenant_id_user_id_idx" ON "ProspectSearchHistory"("tenant_id", "user_id");

-- CreateIndex
CREATE INDEX "ProspectSearchHistory_tenant_id_searched_at_idx" ON "ProspectSearchHistory"("tenant_id", "searched_at");

-- CreateIndex
CREATE INDEX "SavedProspectSearch_tenant_id_idx" ON "SavedProspectSearch"("tenant_id");

-- CreateIndex
CREATE INDEX "SavedProspectSearch_tenant_id_user_id_idx" ON "SavedProspectSearch"("tenant_id", "user_id");

-- AddForeignKey
ALTER TABLE "ProspectSearchHistory" ADD CONSTRAINT "ProspectSearchHistory_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedProspectSearch" ADD CONSTRAINT "SavedProspectSearch_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
