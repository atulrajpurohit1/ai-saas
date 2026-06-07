CREATE TABLE IF NOT EXISTS "SSOProvider" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "provider_type" TEXT NOT NULL,
  "provider_name" TEXT NOT NULL,
  "client_id" TEXT,
  "client_secret" TEXT,
  "issuer_url" TEXT,
  "metadata_url" TEXT,
  "saml_metadata" TEXT,
  "email_domains" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "auto_provision" BOOLEAN NOT NULL DEFAULT true,
  "default_role_id" TEXT,
  "default_branch_id" TEXT,
  "status" TEXT NOT NULL DEFAULT 'inactive',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SSOProvider_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SSORoleMapping" (
  "id" TEXT NOT NULL,
  "provider_id" TEXT NOT NULL,
  "external_group" TEXT NOT NULL,
  "role_id" TEXT NOT NULL,
  "branch_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SSORoleMapping_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SSOLoginState" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "provider_id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "nonce" TEXT NOT NULL,
  "code_verifier" TEXT NOT NULL,
  "redirect_uri" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SSOLoginState_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "UserSession" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "provider_id" TEXT,
  "source" TEXT NOT NULL DEFAULT 'password',
  "refresh_token_hash" TEXT,
  "status" TEXT NOT NULL DEFAULT 'active',
  "ip_address" TEXT,
  "user_agent" TEXT,
  "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revoked_at" TIMESTAMP(3),
  CONSTRAINT "UserSession_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SSOProvider_tenant_id_idx" ON "SSOProvider"("tenant_id");
CREATE INDEX IF NOT EXISTS "SSOProvider_tenant_status_idx" ON "SSOProvider"("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "SSOProvider_tenant_provider_type_idx" ON "SSOProvider"("tenant_id", "provider_type");
CREATE INDEX IF NOT EXISTS "SSORoleMapping_provider_id_idx" ON "SSORoleMapping"("provider_id");
CREATE INDEX IF NOT EXISTS "SSORoleMapping_role_id_idx" ON "SSORoleMapping"("role_id");
CREATE INDEX IF NOT EXISTS "SSORoleMapping_branch_id_idx" ON "SSORoleMapping"("branch_id");
CREATE UNIQUE INDEX IF NOT EXISTS "SSORoleMapping_provider_group_role_branch_key" ON "SSORoleMapping"("provider_id", "external_group", "role_id", "branch_id");
CREATE UNIQUE INDEX IF NOT EXISTS "SSOLoginState_state_key" ON "SSOLoginState"("state");
CREATE INDEX IF NOT EXISTS "SSOLoginState_tenant_id_idx" ON "SSOLoginState"("tenant_id");
CREATE INDEX IF NOT EXISTS "SSOLoginState_provider_id_idx" ON "SSOLoginState"("provider_id");
CREATE INDEX IF NOT EXISTS "SSOLoginState_expires_at_idx" ON "SSOLoginState"("expires_at");
CREATE INDEX IF NOT EXISTS "UserSession_tenant_id_idx" ON "UserSession"("tenant_id");
CREATE INDEX IF NOT EXISTS "UserSession_user_id_idx" ON "UserSession"("user_id");
CREATE INDEX IF NOT EXISTS "UserSession_provider_id_idx" ON "UserSession"("provider_id");
CREATE INDEX IF NOT EXISTS "UserSession_tenant_status_idx" ON "UserSession"("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "UserSession_expires_at_idx" ON "UserSession"("expires_at");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SSOProvider_tenant_id_fkey') THEN
    ALTER TABLE "SSOProvider" ADD CONSTRAINT "SSOProvider_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SSORoleMapping_provider_id_fkey') THEN
    ALTER TABLE "SSORoleMapping" ADD CONSTRAINT "SSORoleMapping_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "SSOProvider"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SSOLoginState_tenant_id_fkey') THEN
    ALTER TABLE "SSOLoginState" ADD CONSTRAINT "SSOLoginState_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SSOLoginState_provider_id_fkey') THEN
    ALTER TABLE "SSOLoginState" ADD CONSTRAINT "SSOLoginState_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "SSOProvider"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UserSession_tenant_id_fkey') THEN
    ALTER TABLE "UserSession" ADD CONSTRAINT "UserSession_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UserSession_user_id_fkey') THEN
    ALTER TABLE "UserSession" ADD CONSTRAINT "UserSession_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UserSession_provider_id_fkey') THEN
    ALTER TABLE "UserSession" ADD CONSTRAINT "UserSession_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "SSOProvider"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

INSERT INTO "Permission" ("id", "key", "name", "description", "module") VALUES
  ('sso.view', 'sso.view', 'View SSO settings', 'Read enterprise SSO providers and role mappings.', 'identity'),
  ('sso.manage', 'sso.manage', 'Manage SSO settings', 'Configure SSO providers, metadata, and role mappings.', 'identity'),
  ('sessions.view', 'sessions.view', 'View sessions', 'Read active user sessions.', 'identity'),
  ('sessions.manage', 'sessions.manage', 'Manage sessions', 'Force logout user sessions.', 'identity')
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
  AND p."key" IN ('sso.view', 'sso.manage', 'sessions.view', 'sessions.manage')
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
