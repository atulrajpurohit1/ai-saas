CREATE TABLE IF NOT EXISTS "TenantBranding" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "company_name" TEXT,
  "logo_url" TEXT,
  "favicon_url" TEXT,
  "primary_color" TEXT NOT NULL DEFAULT '#6366f1',
  "secondary_color" TEXT NOT NULL DEFAULT '#334155',
  "accent_color" TEXT NOT NULL DEFAULT '#818cf8',
  "login_background" TEXT,
  "welcome_message" TEXT,
  "support_email" TEXT,
  "support_phone" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TenantBranding_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CustomDomain" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "domain" TEXT NOT NULL,
  "verification_status" TEXT NOT NULL DEFAULT 'pending',
  "ssl_status" TEXT NOT NULL DEFAULT 'pending',
  "verification_token" TEXT NOT NULL,
  "verified_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CustomDomain_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TenantBranding_tenant_id_key" ON "TenantBranding"("tenant_id");
CREATE INDEX IF NOT EXISTS "TenantBranding_tenant_id_idx" ON "TenantBranding"("tenant_id");
CREATE UNIQUE INDEX IF NOT EXISTS "CustomDomain_domain_key" ON "CustomDomain"("domain");
CREATE INDEX IF NOT EXISTS "CustomDomain_tenant_id_idx" ON "CustomDomain"("tenant_id");
CREATE INDEX IF NOT EXISTS "CustomDomain_tenant_verification_status_idx" ON "CustomDomain"("tenant_id", "verification_status");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TenantBranding_tenant_id_fkey') THEN
    ALTER TABLE "TenantBranding" ADD CONSTRAINT "TenantBranding_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CustomDomain_tenant_id_fkey') THEN
    ALTER TABLE "CustomDomain" ADD CONSTRAINT "CustomDomain_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

INSERT INTO "Permission" ("id", "key", "name", "description", "module")
VALUES
  ('branding.view', 'branding.view', 'View branding', 'Read tenant branding, theme, and domain settings.', 'settings'),
  ('branding.manage', 'branding.manage', 'Manage branding', 'Update tenant logos, colors, support details, and theme settings.', 'settings'),
  ('domains.view', 'domains.view', 'View domains', 'Read custom domain verification and SSL status.', 'settings'),
  ('domains.manage', 'domains.manage', 'Manage domains', 'Add and verify custom tenant domains.', 'settings')
ON CONFLICT ("key") DO UPDATE
SET "name" = EXCLUDED."name",
    "description" = EXCLUDED."description",
    "module" = EXCLUDED."module";

INSERT INTO "RolePermission" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM "Role" r
JOIN "Permission" p ON p."key" IN ('branding.view', 'branding.manage', 'domains.view', 'domains.manage')
WHERE r."name" = 'Super Admin'
ON CONFLICT DO NOTHING;
