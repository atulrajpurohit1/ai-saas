-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'INVITED', 'VIEWED', 'SUBMITTED');

-- AlterTable
ALTER TABLE "RfpVendor" ADD COLUMN     "invitation_status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "invitation_token" TEXT,
ADD COLUMN     "invited_at" TIMESTAMP(3),
ADD COLUMN     "submitted_at" TIMESTAMP(3),
ADD COLUMN     "viewed_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ProposalSubmission" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "rfp_vendor_id" TEXT NOT NULL,
    "proposal_file" TEXT,
    "pricing_file" TEXT,
    "insurance_file" TEXT,
    "license_file" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProposalSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProposalSubmission_rfp_vendor_id_key" ON "ProposalSubmission"("rfp_vendor_id");

-- CreateIndex
CREATE INDEX "ProposalSubmission_tenant_id_idx" ON "ProposalSubmission"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "RfpVendor_invitation_token_key" ON "RfpVendor"("invitation_token");

-- CreateIndex
CREATE INDEX "RfpVendor_invitation_token_idx" ON "RfpVendor"("invitation_token");

-- AddForeignKey
ALTER TABLE "ProposalSubmission" ADD CONSTRAINT "ProposalSubmission_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposalSubmission" ADD CONSTRAINT "ProposalSubmission_rfp_vendor_id_fkey" FOREIGN KEY ("rfp_vendor_id") REFERENCES "RfpVendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
