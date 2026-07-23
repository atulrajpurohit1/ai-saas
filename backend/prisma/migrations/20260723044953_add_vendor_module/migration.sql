-- CreateEnum
CREATE TYPE "VendorStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateTable
CREATE TABLE "Vendor" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "company_name" TEXT NOT NULL,
    "contact_person" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "services" JSONB NOT NULL DEFAULT '[]',
    "notes" TEXT,
    "status" "VendorStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RfpVendor" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "rfp_id" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RfpVendor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Vendor_tenant_id_idx" ON "Vendor"("tenant_id");

-- CreateIndex
CREATE INDEX "Vendor_tenant_id_status_idx" ON "Vendor"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "RfpVendor_tenant_id_idx" ON "RfpVendor"("tenant_id");

-- CreateIndex
CREATE INDEX "RfpVendor_rfp_id_idx" ON "RfpVendor"("rfp_id");

-- CreateIndex
CREATE INDEX "RfpVendor_vendor_id_idx" ON "RfpVendor"("vendor_id");

-- CreateIndex
CREATE UNIQUE INDEX "RfpVendor_rfp_vendor_key" ON "RfpVendor"("rfp_id", "vendor_id");

-- AddForeignKey
ALTER TABLE "Vendor" ADD CONSTRAINT "Vendor_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfpVendor" ADD CONSTRAINT "RfpVendor_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfpVendor" ADD CONSTRAINT "RfpVendor_rfp_id_fkey" FOREIGN KEY ("rfp_id") REFERENCES "Rfp"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfpVendor" ADD CONSTRAINT "RfpVendor_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
