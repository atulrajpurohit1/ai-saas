CREATE TABLE "RateCard" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "site_id" TEXT,
    "role_name" TEXT,
    "hourly_rate" DOUBLE PRECISION NOT NULL,
    "overtime_rate" DOUBLE PRECISION,
    "holiday_rate" DOUBLE PRECISION,
    "effective_from" TIMESTAMP(3) NOT NULL,
    "effective_to" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RateCard_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "RateCard_status_check" CHECK ("status" IN ('active', 'inactive')),
    CONSTRAINT "RateCard_hourly_rate_check" CHECK ("hourly_rate" > 0),
    CONSTRAINT "RateCard_overtime_rate_check" CHECK ("overtime_rate" IS NULL OR "overtime_rate" > 0),
    CONSTRAINT "RateCard_holiday_rate_check" CHECK ("holiday_rate" IS NULL OR "holiday_rate" > 0),
    CONSTRAINT "RateCard_effective_dates_check" CHECK ("effective_to" IS NULL OR "effective_to" >= "effective_from")
);

CREATE INDEX "RateCard_tenant_id_idx" ON "RateCard"("tenant_id");
CREATE INDEX "RateCard_client_id_idx" ON "RateCard"("client_id");
CREATE INDEX "RateCard_site_id_idx" ON "RateCard"("site_id");
CREATE INDEX "RateCard_status_idx" ON "RateCard"("status");
CREATE INDEX "RateCard_effective_from_idx" ON "RateCard"("effective_from");
CREATE INDEX "RateCard_effective_to_idx" ON "RateCard"("effective_to");

ALTER TABLE "RateCard"
ADD CONSTRAINT "RateCard_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RateCard"
ADD CONSTRAINT "RateCard_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RateCard"
ADD CONSTRAINT "RateCard_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Invoice"
ADD COLUMN "rate_card_id" TEXT,
ADD COLUMN "rate_source" TEXT NOT NULL DEFAULT 'manual';

CREATE INDEX "Invoice_rate_card_id_idx" ON "Invoice"("rate_card_id");

ALTER TABLE "Invoice"
ADD CONSTRAINT "Invoice_rate_card_id_fkey" FOREIGN KEY ("rate_card_id") REFERENCES "RateCard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InvoiceItem"
ADD COLUMN "rate_card_id" TEXT;

CREATE INDEX "InvoiceItem_rate_card_id_idx" ON "InvoiceItem"("rate_card_id");

ALTER TABLE "InvoiceItem"
ADD CONSTRAINT "InvoiceItem_rate_card_id_fkey" FOREIGN KEY ("rate_card_id") REFERENCES "RateCard"("id") ON DELETE SET NULL ON UPDATE CASCADE;
