CREATE TABLE "Timesheet" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "guard_id" TEXT NOT NULL,
    "shift_id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "client_id" TEXT,
    "check_in_time" TIMESTAMP(3) NOT NULL,
    "check_out_time" TIMESTAMP(3) NOT NULL,
    "total_hours" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "approved_by" TEXT,
    "approved_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Timesheet_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Timesheet_status_check" CHECK ("status" IN ('pending', 'approved', 'rejected', 'corrected')),
    CONSTRAINT "Timesheet_total_hours_check" CHECK ("total_hours" >= 0),
    CONSTRAINT "Timesheet_time_order_check" CHECK ("check_out_time" >= "check_in_time")
);

CREATE UNIQUE INDEX "Timesheet_tenant_shift_guard_key" ON "Timesheet"("tenant_id", "shift_id", "guard_id");
CREATE INDEX "Timesheet_tenant_id_idx" ON "Timesheet"("tenant_id");
CREATE INDEX "Timesheet_guard_id_idx" ON "Timesheet"("guard_id");
CREATE INDEX "Timesheet_shift_id_idx" ON "Timesheet"("shift_id");
CREATE INDEX "Timesheet_site_id_idx" ON "Timesheet"("site_id");
CREATE INDEX "Timesheet_client_id_idx" ON "Timesheet"("client_id");
CREATE INDEX "Timesheet_status_idx" ON "Timesheet"("status");
CREATE INDEX "Timesheet_created_at_idx" ON "Timesheet"("created_at");

ALTER TABLE "Timesheet"
ADD CONSTRAINT "Timesheet_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Timesheet"
ADD CONSTRAINT "Timesheet_guard_id_fkey" FOREIGN KEY ("guard_id") REFERENCES "Guard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Timesheet"
ADD CONSTRAINT "Timesheet_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "Shift"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Timesheet"
ADD CONSTRAINT "Timesheet_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Timesheet"
ADD CONSTRAINT "Timesheet_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InvoiceItem"
ADD COLUMN "timesheet_id" TEXT;

CREATE INDEX "InvoiceItem_timesheet_id_idx" ON "InvoiceItem"("timesheet_id");

ALTER TABLE "InvoiceItem"
ADD CONSTRAINT "InvoiceItem_timesheet_id_fkey" FOREIGN KEY ("timesheet_id") REFERENCES "Timesheet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "Timesheet" (
    "id",
    "tenant_id",
    "guard_id",
    "shift_id",
    "site_id",
    "client_id",
    "check_in_time",
    "check_out_time",
    "total_hours",
    "status",
    "created_at"
)
SELECT
    CONCAT('ts_', MD5(ci."id" || co."id")),
    ci."tenantId",
    ci."guardId",
    ci."shiftId",
    s."siteId",
    site."client_id",
    ci."timestamp",
    co."timestamp",
    ROUND((GREATEST(EXTRACT(EPOCH FROM (co."timestamp" - ci."timestamp")) / 3600, 0))::numeric, 1)::double precision,
    'pending',
    CURRENT_TIMESTAMP
FROM "AttendanceEvent" ci
INNER JOIN "AttendanceEvent" co
    ON co."tenantId" = ci."tenantId"
    AND co."guardId" = ci."guardId"
    AND co."shiftId" = ci."shiftId"
    AND co."type" = 'CHECK_OUT'
INNER JOIN "Shift" s ON s."id" = ci."shiftId"
INNER JOIN "Site" site ON site."id" = s."siteId"
WHERE ci."type" = 'CHECK_IN'
    AND co."timestamp" >= ci."timestamp"
ON CONFLICT ("tenant_id", "shift_id", "guard_id") DO NOTHING;
