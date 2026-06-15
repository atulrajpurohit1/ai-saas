-- Create field-level RBAC table
CREATE TABLE "FieldPermission" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "role_id" TEXT NOT NULL,
  "entity" TEXT NOT NULL,
  "field" TEXT NOT NULL,
  "can_view" BOOLEAN NOT NULL DEFAULT true,
  "can_edit" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "FieldPermission_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FieldPermission_role_entity_field_key" ON "FieldPermission"("role_id", "entity", "field");
CREATE INDEX "FieldPermission_tenant_id_idx" ON "FieldPermission"("tenant_id");
CREATE INDEX "FieldPermission_role_id_idx" ON "FieldPermission"("role_id");
CREATE INDEX "FieldPermission_tenant_id_entity_idx" ON "FieldPermission"("tenant_id", "entity");

ALTER TABLE "FieldPermission"
  ADD CONSTRAINT "FieldPermission_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FieldPermission"
  ADD CONSTRAINT "FieldPermission_role_id_fkey"
  FOREIGN KEY ("role_id") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add sensitive fields protected by field-level RBAC
ALTER TABLE "Guard" ADD COLUMN "salary" DOUBLE PRECISION;
ALTER TABLE "Guard" ADD COLUMN "bank_details" TEXT;
ALTER TABLE "Guard" ADD COLUMN "documents" TEXT;
ALTER TABLE "Guard" ADD COLUMN "personal_notes" TEXT;

ALTER TABLE "Client" ADD COLUMN "billing_notes" TEXT;
ALTER TABLE "Client" ADD COLUMN "internal_notes" TEXT;

ALTER TABLE "Invoice" ADD COLUMN "internal_adjustments" TEXT;
