CREATE TABLE "AiConversation" (
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

CREATE INDEX "AiConversation_tenant_id_idx" ON "AiConversation"("tenant_id");
CREATE INDEX "AiConversation_tenant_id_user_id_idx" ON "AiConversation"("tenant_id", "user_id");
CREATE INDEX "AiConversation_tenant_id_created_at_idx" ON "AiConversation"("tenant_id", "created_at");

ALTER TABLE "AiConversation" ADD CONSTRAINT "AiConversation_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
