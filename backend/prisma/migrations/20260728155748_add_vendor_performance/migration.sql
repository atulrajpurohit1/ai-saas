-- CreateTable
CREATE TABLE "VendorPerformance" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "rfp_id" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "review_date" TIMESTAMP(3) NOT NULL,
    "overall_rating" INTEGER NOT NULL,
    "sla_compliance" DOUBLE PRECISION NOT NULL,
    "incident_count" INTEGER NOT NULL,
    "response_time" TEXT NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VendorPerformance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VendorPerformance_tenant_id_idx" ON "VendorPerformance"("tenant_id");

-- CreateIndex
CREATE INDEX "VendorPerformance_rfp_id_idx" ON "VendorPerformance"("rfp_id");

-- CreateIndex
CREATE INDEX "VendorPerformance_vendor_id_idx" ON "VendorPerformance"("vendor_id");

-- AddForeignKey
ALTER TABLE "VendorPerformance" ADD CONSTRAINT "VendorPerformance_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorPerformance" ADD CONSTRAINT "VendorPerformance_rfp_id_fkey" FOREIGN KEY ("rfp_id") REFERENCES "Rfp"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorPerformance" ADD CONSTRAINT "VendorPerformance_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
