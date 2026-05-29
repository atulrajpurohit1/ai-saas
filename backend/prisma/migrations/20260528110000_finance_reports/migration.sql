ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'FINANCE';

ALTER TABLE "Invoice" ADD COLUMN "paid_at" TIMESTAMP(3);
ALTER TABLE "Invoice" ADD COLUMN "due_date" TIMESTAMP(3);

CREATE INDEX "Invoice_issued_at_idx" ON "Invoice"("issued_at");
CREATE INDEX "Invoice_paid_at_idx" ON "Invoice"("paid_at");
CREATE INDEX "Invoice_due_date_idx" ON "Invoice"("due_date");
