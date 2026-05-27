CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "invoice_number" TEXT NOT NULL,
    "billing_start_date" TIMESTAMP(3) NOT NULL,
    "billing_end_date" TIMESTAMP(3) NOT NULL,
    "total_hours" DOUBLE PRECISION NOT NULL,
    "hourly_rate" DOUBLE PRECISION NOT NULL,
    "subtotal" DOUBLE PRECISION NOT NULL,
    "tax" DOUBLE PRECISION NOT NULL,
    "total_amount" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "issued_at" TIMESTAMP(3),

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Invoice_status_check" CHECK ("status" IN ('draft', 'issued', 'paid'))
);

CREATE TABLE "InvoiceItem" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "shift_id" TEXT NOT NULL,
    "guard_id" TEXT NOT NULL,
    "worked_hours" DOUBLE PRECISION NOT NULL,
    "hourly_rate" DOUBLE PRECISION NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "InvoiceItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Invoice_tenant_invoice_number_key" ON "Invoice"("tenant_id", "invoice_number");
CREATE UNIQUE INDEX "Invoice_period_key" ON "Invoice"("tenant_id", "client_id", "site_id", "billing_start_date", "billing_end_date");
CREATE INDEX "Invoice_tenant_id_idx" ON "Invoice"("tenant_id");
CREATE INDEX "Invoice_client_id_idx" ON "Invoice"("client_id");
CREATE INDEX "Invoice_site_id_idx" ON "Invoice"("site_id");
CREATE INDEX "Invoice_status_idx" ON "Invoice"("status");
CREATE INDEX "Invoice_billing_start_date_idx" ON "Invoice"("billing_start_date");
CREATE INDEX "Invoice_billing_end_date_idx" ON "Invoice"("billing_end_date");

CREATE UNIQUE INDEX "InvoiceItem_invoice_id_shift_id_guard_id_key" ON "InvoiceItem"("invoice_id", "shift_id", "guard_id");
CREATE INDEX "InvoiceItem_invoice_id_idx" ON "InvoiceItem"("invoice_id");
CREATE INDEX "InvoiceItem_shift_id_idx" ON "InvoiceItem"("shift_id");
CREATE INDEX "InvoiceItem_guard_id_idx" ON "InvoiceItem"("guard_id");

ALTER TABLE "Invoice"
ADD CONSTRAINT "Invoice_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Invoice"
ADD CONSTRAINT "Invoice_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Invoice"
ADD CONSTRAINT "Invoice_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "InvoiceItem"
ADD CONSTRAINT "InvoiceItem_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InvoiceItem"
ADD CONSTRAINT "InvoiceItem_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "Shift"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "InvoiceItem"
ADD CONSTRAINT "InvoiceItem_guard_id_fkey" FOREIGN KEY ("guard_id") REFERENCES "Guard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
