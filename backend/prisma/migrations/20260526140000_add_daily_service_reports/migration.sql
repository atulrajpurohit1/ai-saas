CREATE TABLE "DailyServiceReport" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "report_date" TIMESTAMP(3) NOT NULL,
    "summary" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published_at" TIMESTAMP(3),

    CONSTRAINT "DailyServiceReport_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "DailyServiceReport_status_check" CHECK ("status" IN ('draft', 'published'))
);

CREATE INDEX "DailyServiceReport_tenant_id_idx" ON "DailyServiceReport"("tenant_id");
CREATE INDEX "DailyServiceReport_client_id_idx" ON "DailyServiceReport"("client_id");
CREATE INDEX "DailyServiceReport_site_id_idx" ON "DailyServiceReport"("site_id");
CREATE INDEX "DailyServiceReport_report_date_idx" ON "DailyServiceReport"("report_date");
CREATE INDEX "DailyServiceReport_status_idx" ON "DailyServiceReport"("status");

ALTER TABLE "DailyServiceReport"
ADD CONSTRAINT "DailyServiceReport_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DailyServiceReport"
ADD CONSTRAINT "DailyServiceReport_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DailyServiceReport"
ADD CONSTRAINT "DailyServiceReport_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
