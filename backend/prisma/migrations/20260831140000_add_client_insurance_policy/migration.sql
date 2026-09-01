-- Phase 3G: client / site insurance & Certificate-of-Insurance (COI) tracking.
-- New table only - no existing data touched.
CREATE TABLE "ClientInsurancePolicy" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "site_id" TEXT,
    "type" TEXT NOT NULL,
    "policy_number" TEXT,
    "insurer" TEXT,
    "coverage_amount" DOUBLE PRECISION,
    "effective_date" TIMESTAMP(3),
    "expiration_date" TIMESTAMP(3),
    "notes" TEXT,
    "file_name" TEXT,
    "stored_file_name" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientInsurancePolicy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClientInsurancePolicy_tenant_id_idx" ON "ClientInsurancePolicy"("tenant_id");

-- CreateIndex
CREATE INDEX "ClientInsurancePolicy_client_id_idx" ON "ClientInsurancePolicy"("client_id");

-- CreateIndex
CREATE INDEX "ClientInsurancePolicy_site_id_idx" ON "ClientInsurancePolicy"("site_id");

-- CreateIndex
CREATE INDEX "ClientInsurancePolicy_type_idx" ON "ClientInsurancePolicy"("type");

-- CreateIndex
CREATE INDEX "ClientInsurancePolicy_expiration_date_idx" ON "ClientInsurancePolicy"("expiration_date");

-- AddForeignKey
ALTER TABLE "ClientInsurancePolicy" ADD CONSTRAINT "ClientInsurancePolicy_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientInsurancePolicy" ADD CONSTRAINT "ClientInsurancePolicy_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientInsurancePolicy" ADD CONSTRAINT "ClientInsurancePolicy_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;
