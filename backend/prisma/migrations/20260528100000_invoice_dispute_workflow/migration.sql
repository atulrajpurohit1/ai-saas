ALTER TABLE "Invoice" DROP CONSTRAINT IF EXISTS "Invoice_status_check";

ALTER TABLE "Invoice"
ADD CONSTRAINT "Invoice_status_check"
CHECK ("status" IN ('draft', 'issued', 'disputed', 'resolved', 'paid', 'cancelled'));

CREATE TABLE "InvoiceDispute" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "admin_response" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "InvoiceDispute_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "InvoiceDispute_status_check" CHECK ("status" IN ('open', 'under_review', 'resolved', 'rejected'))
);

CREATE INDEX "InvoiceDispute_invoice_id_idx" ON "InvoiceDispute"("invoice_id");
CREATE INDEX "InvoiceDispute_client_id_idx" ON "InvoiceDispute"("client_id");
CREATE INDEX "InvoiceDispute_tenant_id_idx" ON "InvoiceDispute"("tenant_id");
CREATE INDEX "InvoiceDispute_status_idx" ON "InvoiceDispute"("status");
CREATE INDEX "InvoiceDispute_created_at_idx" ON "InvoiceDispute"("created_at");

ALTER TABLE "InvoiceDispute"
ADD CONSTRAINT "InvoiceDispute_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InvoiceDispute"
ADD CONSTRAINT "InvoiceDispute_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "InvoiceDispute"
ADD CONSTRAINT "InvoiceDispute_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
