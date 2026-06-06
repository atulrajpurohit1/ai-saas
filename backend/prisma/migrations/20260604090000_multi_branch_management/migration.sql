CREATE TABLE IF NOT EXISTS "Branch" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "location" TEXT NOT NULL,
  "manager_id" TEXT,
  "status" TEXT NOT NULL DEFAULT 'active',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "branch_id" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "is_super_admin" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "branch_id" TEXT;
ALTER TABLE "Site" ADD COLUMN IF NOT EXISTS "branch_id" TEXT;
ALTER TABLE "Guard" ADD COLUMN IF NOT EXISTS "branch_id" TEXT;
ALTER TABLE "Shift" ADD COLUMN IF NOT EXISTS "branch_id" TEXT;
ALTER TABLE "Incident" ADD COLUMN IF NOT EXISTS "branch_id" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "branch_id" TEXT;
ALTER TABLE "DailyServiceReport" ADD COLUMN IF NOT EXISTS "branch_id" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Branch_tenant_id_fkey') THEN
    ALTER TABLE "Branch" ADD CONSTRAINT "Branch_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Branch_manager_id_fkey') THEN
    ALTER TABLE "Branch" ADD CONSTRAINT "Branch_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'User_branch_id_fkey') THEN
    ALTER TABLE "User" ADD CONSTRAINT "User_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Client_branch_id_fkey') THEN
    ALTER TABLE "Client" ADD CONSTRAINT "Client_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Site_branch_id_fkey') THEN
    ALTER TABLE "Site" ADD CONSTRAINT "Site_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Guard_branch_id_fkey') THEN
    ALTER TABLE "Guard" ADD CONSTRAINT "Guard_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Shift_branch_id_fkey') THEN
    ALTER TABLE "Shift" ADD CONSTRAINT "Shift_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Incident_branch_id_fkey') THEN
    ALTER TABLE "Incident" ADD CONSTRAINT "Incident_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Invoice_branch_id_fkey') THEN
    ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DailyServiceReport_branch_id_fkey') THEN
    ALTER TABLE "DailyServiceReport" ADD CONSTRAINT "DailyServiceReport_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Branch_tenant_id_idx" ON "Branch"("tenant_id");
CREATE INDEX IF NOT EXISTS "Branch_manager_id_idx" ON "Branch"("manager_id");
CREATE INDEX IF NOT EXISTS "Branch_tenant_status_idx" ON "Branch"("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "User_branch_id_idx" ON "User"("branch_id");
CREATE INDEX IF NOT EXISTS "Client_branch_id_idx" ON "Client"("branch_id");
CREATE INDEX IF NOT EXISTS "Site_branch_id_idx" ON "Site"("branch_id");
CREATE INDEX IF NOT EXISTS "Guard_branch_id_idx" ON "Guard"("branch_id");
CREATE INDEX IF NOT EXISTS "Shift_branch_id_idx" ON "Shift"("branch_id");
CREATE INDEX IF NOT EXISTS "Incident_branch_id_idx" ON "Incident"("branch_id");
CREATE INDEX IF NOT EXISTS "Invoice_branch_id_idx" ON "Invoice"("branch_id");
CREATE INDEX IF NOT EXISTS "DailyServiceReport_branch_id_idx" ON "DailyServiceReport"("branch_id");
