CREATE TABLE IF NOT EXISTS "Permission" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "module" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Role" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "is_system_role" BOOLEAN NOT NULL DEFAULT false,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "RolePermission" (
  "role_id" TEXT NOT NULL,
  "permission_id" TEXT NOT NULL,
  "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("role_id", "permission_id")
);

CREATE TABLE IF NOT EXISTS "UserRoleAssignment" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "role_id" TEXT NOT NULL,
  "branch_id" TEXT,
  "assigned_by" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revoked_at" TIMESTAMP(3),
  CONSTRAINT "UserRoleAssignment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Permission_key_key" ON "Permission"("key");
CREATE INDEX IF NOT EXISTS "Permission_module_idx" ON "Permission"("module");
CREATE UNIQUE INDEX IF NOT EXISTS "Role_tenant_name_key" ON "Role"("tenant_id", "name");
CREATE INDEX IF NOT EXISTS "Role_tenant_id_idx" ON "Role"("tenant_id");
CREATE INDEX IF NOT EXISTS "Role_tenant_active_idx" ON "Role"("tenant_id", "is_active");
CREATE INDEX IF NOT EXISTS "RolePermission_permission_id_idx" ON "RolePermission"("permission_id");
CREATE INDEX IF NOT EXISTS "UserRoleAssignment_tenant_id_idx" ON "UserRoleAssignment"("tenant_id");
CREATE INDEX IF NOT EXISTS "UserRoleAssignment_user_id_idx" ON "UserRoleAssignment"("user_id");
CREATE INDEX IF NOT EXISTS "UserRoleAssignment_role_id_idx" ON "UserRoleAssignment"("role_id");
CREATE INDEX IF NOT EXISTS "UserRoleAssignment_branch_id_idx" ON "UserRoleAssignment"("branch_id");
CREATE UNIQUE INDEX IF NOT EXISTS "UserRoleAssignment_user_role_branch_key" ON "UserRoleAssignment"("user_id", "role_id", "branch_id");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Role_tenant_id_fkey') THEN
    ALTER TABLE "Role" ADD CONSTRAINT "Role_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RolePermission_role_id_fkey') THEN
    ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RolePermission_permission_id_fkey') THEN
    ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UserRoleAssignment_tenant_id_fkey') THEN
    ALTER TABLE "UserRoleAssignment" ADD CONSTRAINT "UserRoleAssignment_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UserRoleAssignment_user_id_fkey') THEN
    ALTER TABLE "UserRoleAssignment" ADD CONSTRAINT "UserRoleAssignment_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UserRoleAssignment_role_id_fkey') THEN
    ALTER TABLE "UserRoleAssignment" ADD CONSTRAINT "UserRoleAssignment_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UserRoleAssignment_branch_id_fkey') THEN
    ALTER TABLE "UserRoleAssignment" ADD CONSTRAINT "UserRoleAssignment_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

INSERT INTO "Permission" ("id", "key", "name", "description", "module") VALUES
  ('dashboard.view', 'dashboard.view', 'View dashboard', 'Access the admin dashboard.', 'dashboard'),
  ('leads.view', 'leads.view', 'View leads', 'Read CRM leads.', 'leads'),
  ('leads.create', 'leads.create', 'Create leads', 'Create CRM leads.', 'leads'),
  ('leads.update', 'leads.update', 'Update leads', 'Update CRM leads and lead status.', 'leads'),
  ('leads.delete', 'leads.delete', 'Delete leads', 'Delete CRM leads.', 'leads'),
  ('leads.import', 'leads.import', 'Import leads', 'Import or parse leads from files.', 'leads'),
  ('leads.export', 'leads.export', 'Export leads', 'Export leads to CSV.', 'leads'),
  ('deals.view', 'deals.view', 'View deals', 'Read deals.', 'deals'),
  ('deals.create', 'deals.create', 'Create deals', 'Create or convert deals.', 'deals'),
  ('deals.update', 'deals.update', 'Update deals', 'Update deal stage and details.', 'deals'),
  ('deals.delete', 'deals.delete', 'Delete deals', 'Delete deals.', 'deals'),
  ('proposals.view', 'proposals.view', 'View proposals', 'Read proposals.', 'proposals'),
  ('proposals.create', 'proposals.create', 'Create proposals', 'Create proposals.', 'proposals'),
  ('proposals.update', 'proposals.update', 'Update proposals', 'Update proposals.', 'proposals'),
  ('proposals.delete', 'proposals.delete', 'Delete proposals', 'Delete proposals.', 'proposals'),
  ('clients.view', 'clients.view', 'View clients', 'Read clients.', 'clients'),
  ('clients.manage', 'clients.manage', 'Manage clients', 'Create and update clients and client users.', 'clients'),
  ('sites.view', 'sites.view', 'View sites', 'Read sites.', 'sites'),
  ('sites.manage', 'sites.manage', 'Manage sites', 'Create and update sites.', 'sites'),
  ('guards.view', 'guards.view', 'View guards', 'Read guard records.', 'guards'),
  ('guards.manage', 'guards.manage', 'Manage guards', 'Create, update, and manage guard availability.', 'guards'),
  ('shifts.view', 'shifts.view', 'View shifts', 'Read shifts and guard recommendations.', 'shifts'),
  ('shifts.create', 'shifts.create', 'Create shifts', 'Create shifts.', 'shifts'),
  ('shifts.assign', 'shifts.assign', 'Assign shifts', 'Assign or unassign guards to shifts.', 'shifts'),
  ('shifts.delete', 'shifts.delete', 'Delete shifts', 'Delete shifts.', 'shifts'),
  ('incidents.view', 'incidents.view', 'View incidents', 'Read incidents.', 'incidents'),
  ('incidents.create', 'incidents.create', 'Create incidents', 'Create incidents.', 'incidents'),
  ('incidents.review', 'incidents.review', 'Review incidents', 'Review incident submissions.', 'incidents'),
  ('reports.view', 'reports.view', 'View reports', 'Read daily service reports.', 'reports'),
  ('reports.create', 'reports.create', 'Create reports', 'Generate daily service reports.', 'reports'),
  ('reports.publish', 'reports.publish', 'Publish reports', 'Publish daily service reports.', 'reports'),
  ('reports.export', 'reports.export', 'Export reports', 'Export report PDFs.', 'reports'),
  ('timesheets.view', 'timesheets.view', 'View timesheets', 'Read timesheets.', 'timesheets'),
  ('timesheets.approve', 'timesheets.approve', 'Approve timesheets', 'Approve or reject timesheets.', 'timesheets'),
  ('timesheets.correct', 'timesheets.correct', 'Correct timesheets', 'Correct submitted timesheets.', 'timesheets'),
  ('invoices.view', 'invoices.view', 'View invoices', 'Read invoices.', 'invoices'),
  ('invoices.generate', 'invoices.generate', 'Generate invoices', 'Generate invoices from timesheets.', 'invoices'),
  ('invoices.issue', 'invoices.issue', 'Issue invoices', 'Issue invoices to clients.', 'invoices'),
  ('invoices.mark_paid', 'invoices.mark_paid', 'Mark invoices paid', 'Mark invoices as paid.', 'invoices'),
  ('invoices.cancel', 'invoices.cancel', 'Cancel invoices', 'Cancel invoices.', 'invoices'),
  ('invoices.export', 'invoices.export', 'Export invoices', 'Export invoice PDFs.', 'invoices'),
  ('invoice_disputes.view', 'invoice_disputes.view', 'View invoice disputes', 'Read invoice disputes.', 'invoice_disputes'),
  ('invoice_disputes.respond', 'invoice_disputes.respond', 'Respond to disputes', 'Respond, resolve, or reject invoice disputes.', 'invoice_disputes'),
  ('finance.view', 'finance.view', 'View finance', 'Access finance dashboards and reports.', 'finance'),
  ('finance.export', 'finance.export', 'Export finance', 'Export finance reports.', 'finance'),
  ('branches.view', 'branches.view', 'View branches', 'Read branches.', 'branches'),
  ('branches.manage', 'branches.manage', 'Manage branches', 'Create and update branches.', 'branches'),
  ('ai.view', 'ai.view', 'View AI', 'Access AI insights and copilots.', 'ai'),
  ('ai.manage', 'ai.manage', 'Manage AI', 'Manage AI actions, monitoring, and predictions.', 'ai'),
  ('ai.governance', 'ai.governance', 'AI governance', 'Manage AI prompts and audit.', 'ai'),
  ('rate_cards.view', 'rate_cards.view', 'View rate cards', 'Read rate cards.', 'rate_cards'),
  ('rate_cards.manage', 'rate_cards.manage', 'Manage rate cards', 'Create, update, and deactivate rate cards.', 'rate_cards'),
  ('knowledge_base.view', 'knowledge_base.view', 'View knowledge base', 'Read knowledge entries.', 'knowledge_base'),
  ('knowledge_base.manage', 'knowledge_base.manage', 'Manage knowledge base', 'Create and update knowledge entries.', 'knowledge_base'),
  ('audit.view', 'audit.view', 'View audit log', 'Read activity and audit logs.', 'audit'),
  ('roles.view', 'roles.view', 'View roles', 'Read roles and permissions.', 'settings'),
  ('roles.manage', 'roles.manage', 'Manage roles', 'Create, update, and deactivate custom roles.', 'settings'),
  ('users.view', 'users.view', 'View users', 'Read tenant users.', 'settings'),
  ('users.assign_roles', 'users.assign_roles', 'Assign user roles', 'Assign roles to users.', 'settings'),
  ('activities.view', 'activities.view', 'View activities', 'Read CRM activities.', 'activities'),
  ('activities.manage', 'activities.manage', 'Manage activities', 'Create and update CRM activities.', 'activities'),
  ('notes.manage', 'notes.manage', 'Manage notes', 'Create and update notes.', 'notes'),
  ('documents.manage', 'documents.manage', 'Manage documents', 'Upload and manage client documents.', 'documents')
ON CONFLICT ("key") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "module" = EXCLUDED."module";

WITH system_roles("name", "description") AS (
  VALUES
    ('Super Admin', 'Full tenant administration across every module.'),
    ('Branch Admin', 'Branch-scoped administration for operations teams.'),
    ('Scheduler', 'Shift scheduling and guard assignment.'),
    ('Supervisor', 'Operational supervision, incidents, reports, and timesheets.'),
    ('Finance', 'Finance, invoices, disputes, and rate cards.'),
    ('Guard', 'Restricted guard portal capabilities.'),
    ('Client', 'Restricted client portal capabilities.')
)
INSERT INTO "Role" ("id", "tenant_id", "name", "description", "is_system_role", "is_active", "created_at", "updated_at")
SELECT
  t."id" || ':role:' || lower(replace(sr."name", ' ', '-')),
  t."id",
  sr."name",
  sr."description",
  true,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Tenant" t
CROSS JOIN system_roles sr
ON CONFLICT ("tenant_id", "name") DO UPDATE SET
  "description" = EXCLUDED."description",
  "is_system_role" = true,
  "is_active" = true,
  "updated_at" = CURRENT_TIMESTAMP;

INSERT INTO "RolePermission" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM "Role" r
CROSS JOIN "Permission" p
WHERE r."is_system_role" = true
  AND r."name" = 'Super Admin'
ON CONFLICT ("role_id", "permission_id") DO NOTHING;

WITH role_permissions("role_name", "permission_key") AS (
  VALUES
    ('Branch Admin', 'dashboard.view'),
    ('Branch Admin', 'leads.view'), ('Branch Admin', 'leads.create'), ('Branch Admin', 'leads.update'), ('Branch Admin', 'leads.delete'), ('Branch Admin', 'leads.import'), ('Branch Admin', 'leads.export'),
    ('Branch Admin', 'deals.view'), ('Branch Admin', 'deals.create'), ('Branch Admin', 'deals.update'), ('Branch Admin', 'deals.delete'),
    ('Branch Admin', 'proposals.view'), ('Branch Admin', 'proposals.create'), ('Branch Admin', 'proposals.update'), ('Branch Admin', 'proposals.delete'),
    ('Branch Admin', 'clients.view'), ('Branch Admin', 'clients.manage'), ('Branch Admin', 'sites.view'), ('Branch Admin', 'sites.manage'),
    ('Branch Admin', 'guards.view'), ('Branch Admin', 'guards.manage'), ('Branch Admin', 'shifts.view'), ('Branch Admin', 'shifts.create'), ('Branch Admin', 'shifts.assign'), ('Branch Admin', 'shifts.delete'),
    ('Branch Admin', 'incidents.view'), ('Branch Admin', 'incidents.review'), ('Branch Admin', 'reports.view'), ('Branch Admin', 'reports.create'), ('Branch Admin', 'reports.publish'), ('Branch Admin', 'reports.export'),
    ('Branch Admin', 'timesheets.view'), ('Branch Admin', 'timesheets.approve'), ('Branch Admin', 'timesheets.correct'), ('Branch Admin', 'invoices.view'), ('Branch Admin', 'invoices.generate'), ('Branch Admin', 'invoices.export'),
    ('Branch Admin', 'branches.view'), ('Branch Admin', 'ai.view'), ('Branch Admin', 'rate_cards.view'), ('Branch Admin', 'knowledge_base.view'), ('Branch Admin', 'audit.view'), ('Branch Admin', 'roles.view'), ('Branch Admin', 'users.view'), ('Branch Admin', 'activities.view'), ('Branch Admin', 'activities.manage'), ('Branch Admin', 'notes.manage'), ('Branch Admin', 'documents.manage'),
    ('Scheduler', 'dashboard.view'), ('Scheduler', 'branches.view'), ('Scheduler', 'sites.view'), ('Scheduler', 'guards.view'), ('Scheduler', 'shifts.view'), ('Scheduler', 'shifts.create'), ('Scheduler', 'shifts.assign'), ('Scheduler', 'shifts.delete'), ('Scheduler', 'ai.view'),
    ('Supervisor', 'dashboard.view'), ('Supervisor', 'branches.view'), ('Supervisor', 'sites.view'), ('Supervisor', 'guards.view'), ('Supervisor', 'shifts.view'), ('Supervisor', 'incidents.view'), ('Supervisor', 'incidents.review'), ('Supervisor', 'reports.view'), ('Supervisor', 'reports.create'), ('Supervisor', 'reports.publish'), ('Supervisor', 'reports.export'), ('Supervisor', 'timesheets.view'), ('Supervisor', 'timesheets.approve'), ('Supervisor', 'timesheets.correct'), ('Supervisor', 'ai.view'),
    ('Finance', 'dashboard.view'), ('Finance', 'branches.view'), ('Finance', 'clients.view'), ('Finance', 'sites.view'), ('Finance', 'invoices.view'), ('Finance', 'invoices.generate'), ('Finance', 'invoices.issue'), ('Finance', 'invoices.mark_paid'), ('Finance', 'invoices.cancel'), ('Finance', 'invoices.export'), ('Finance', 'invoice_disputes.view'), ('Finance', 'invoice_disputes.respond'), ('Finance', 'finance.view'), ('Finance', 'finance.export'), ('Finance', 'rate_cards.view'), ('Finance', 'rate_cards.manage'), ('Finance', 'ai.view'),
    ('Guard', 'shifts.view'), ('Guard', 'incidents.create'),
    ('Client', 'invoices.view'), ('Client', 'reports.view'), ('Client', 'incidents.view'), ('Client', 'incidents.create')
)
INSERT INTO "RolePermission" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM "Role" r
JOIN role_permissions rp ON rp."role_name" = r."name"
JOIN "Permission" p ON p."key" = rp."permission_key"
WHERE r."is_system_role" = true
ON CONFLICT ("role_id", "permission_id") DO NOTHING;

WITH default_user_roles AS (
  SELECT
    u."id" AS "user_id",
    u."tenantId" AS "tenant_id",
    CASE
      WHEN u."is_super_admin" = true THEN 'Super Admin'
      WHEN u."role"::text = 'FINANCE' THEN 'Finance'
      ELSE 'Branch Admin'
    END AS "role_name",
    CASE
      WHEN u."is_super_admin" = true THEN NULL
      ELSE u."branch_id"
    END AS "branch_id"
  FROM "User" u
)
INSERT INTO "UserRoleAssignment" ("id", "tenant_id", "user_id", "role_id", "branch_id", "assigned_by", "is_active", "assigned_at")
SELECT
  dur."user_id" || ':assignment:' || r."id",
  dur."tenant_id",
  dur."user_id",
  r."id",
  dur."branch_id",
  NULL,
  true,
  CURRENT_TIMESTAMP
FROM default_user_roles dur
JOIN "Role" r ON r."tenant_id" = dur."tenant_id" AND r."name" = dur."role_name"
WHERE NOT EXISTS (
  SELECT 1
  FROM "UserRoleAssignment" ura
  WHERE ura."tenant_id" = dur."tenant_id"
    AND ura."user_id" = dur."user_id"
    AND ura."is_active" = true
)
ON CONFLICT DO NOTHING;
