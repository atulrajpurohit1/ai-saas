-- CreateIndex
CREATE INDEX "Rfp_awarded_vendor_id_idx" ON "Rfp"("awarded_vendor_id");

-- AddForeignKey
ALTER TABLE "Rfp" ADD CONSTRAINT "Rfp_awarded_vendor_id_fkey" FOREIGN KEY ("awarded_vendor_id") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
