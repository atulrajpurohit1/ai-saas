CREATE TABLE "KnowledgeEntry" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "source_type" TEXT,
    "source_id" TEXT,
    "summary" TEXT NOT NULL,
    "detailed_content" TEXT NOT NULL,
    "keywords" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "archived_at" TIMESTAMP(3),

    CONSTRAINT "KnowledgeEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "KnowledgeEntry_tenant_id_idx" ON "KnowledgeEntry"("tenant_id");
CREATE INDEX "KnowledgeEntry_tenant_id_category_idx" ON "KnowledgeEntry"("tenant_id", "category");
CREATE INDEX "KnowledgeEntry_tenant_id_source_type_source_id_idx" ON "KnowledgeEntry"("tenant_id", "source_type", "source_id");
CREATE INDEX "KnowledgeEntry_tenant_id_archived_at_idx" ON "KnowledgeEntry"("tenant_id", "archived_at");

ALTER TABLE "KnowledgeEntry" ADD CONSTRAINT "KnowledgeEntry_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
