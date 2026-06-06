CREATE TABLE IF NOT EXISTS "ApiKey" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "api_key" TEXT NOT NULL,
  "key_prefix" TEXT NOT NULL,
  "permissions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "status" TEXT NOT NULL DEFAULT 'active',
  "expires_at" TIMESTAMP(3),
  "rate_limit_per_minute" INTEGER NOT NULL DEFAULT 120,
  "last_used_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Webhook" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "event_type" TEXT NOT NULL,
  "endpoint_url" TEXT NOT NULL,
  "secret_key" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Webhook_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "WebhookDelivery" (
  "id" TEXT NOT NULL,
  "webhook_id" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "response_status" INTEGER,
  "success" BOOLEAN NOT NULL DEFAULT false,
  "retry_count" INTEGER NOT NULL DEFAULT 0,
  "last_error" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "delivered_at" TIMESTAMP(3),
  CONSTRAINT "WebhookDelivery_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ApiRequestLog" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "api_key_id" TEXT NOT NULL,
  "endpoint" TEXT NOT NULL,
  "method" TEXT NOT NULL,
  "status_code" INTEGER NOT NULL,
  "ip_address" TEXT,
  "user_agent" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ApiRequestLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ApiKey_api_key_key" ON "ApiKey"("api_key");
CREATE INDEX IF NOT EXISTS "ApiKey_tenant_id_idx" ON "ApiKey"("tenant_id");
CREATE INDEX IF NOT EXISTS "ApiKey_tenant_status_idx" ON "ApiKey"("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "Webhook_tenant_id_idx" ON "Webhook"("tenant_id");
CREATE INDEX IF NOT EXISTS "Webhook_tenant_event_type_idx" ON "Webhook"("tenant_id", "event_type");
CREATE INDEX IF NOT EXISTS "Webhook_tenant_status_idx" ON "Webhook"("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "WebhookDelivery_webhook_id_idx" ON "WebhookDelivery"("webhook_id");
CREATE INDEX IF NOT EXISTS "WebhookDelivery_success_idx" ON "WebhookDelivery"("success");
CREATE INDEX IF NOT EXISTS "WebhookDelivery_created_at_idx" ON "WebhookDelivery"("created_at");
CREATE INDEX IF NOT EXISTS "ApiRequestLog_tenant_id_idx" ON "ApiRequestLog"("tenant_id");
CREATE INDEX IF NOT EXISTS "ApiRequestLog_api_key_id_idx" ON "ApiRequestLog"("api_key_id");
CREATE INDEX IF NOT EXISTS "ApiRequestLog_tenant_created_at_idx" ON "ApiRequestLog"("tenant_id", "created_at");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ApiKey_tenant_id_fkey') THEN
    ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Webhook_tenant_id_fkey') THEN
    ALTER TABLE "Webhook" ADD CONSTRAINT "Webhook_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WebhookDelivery_webhook_id_fkey') THEN
    ALTER TABLE "WebhookDelivery" ADD CONSTRAINT "WebhookDelivery_webhook_id_fkey" FOREIGN KEY ("webhook_id") REFERENCES "Webhook"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ApiRequestLog_tenant_id_fkey') THEN
    ALTER TABLE "ApiRequestLog" ADD CONSTRAINT "ApiRequestLog_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ApiRequestLog_api_key_id_fkey') THEN
    ALTER TABLE "ApiRequestLog" ADD CONSTRAINT "ApiRequestLog_api_key_id_fkey" FOREIGN KEY ("api_key_id") REFERENCES "ApiKey"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

INSERT INTO "Permission" ("id", "key", "name", "description", "module") VALUES
  ('api_keys.view', 'api_keys.view', 'View API keys', 'Read tenant API keys and public API usage.', 'integrations'),
  ('api_keys.manage', 'api_keys.manage', 'Manage API keys', 'Create, revoke, regenerate, and assign API key permissions.', 'integrations'),
  ('webhooks.view', 'webhooks.view', 'View webhooks', 'Read webhook configuration and delivery history.', 'integrations'),
  ('webhooks.manage', 'webhooks.manage', 'Manage webhooks', 'Create, update, revoke, and retry webhooks.', 'integrations'),
  ('integrations.view', 'integrations.view', 'View integrations', 'Access integration center dashboards and logs.', 'integrations')
ON CONFLICT ("key") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "module" = EXCLUDED."module";

INSERT INTO "RolePermission" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM "Role" r
CROSS JOIN "Permission" p
WHERE r."is_system_role" = true
  AND r."name" = 'Super Admin'
  AND p."key" IN ('api_keys.view', 'api_keys.manage', 'webhooks.view', 'webhooks.manage', 'integrations.view')
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
