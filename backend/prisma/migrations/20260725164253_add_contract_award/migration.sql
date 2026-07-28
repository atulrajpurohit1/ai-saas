-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "RfpStatus" ADD VALUE 'EVALUATED';
ALTER TYPE "RfpStatus" ADD VALUE 'AWARDED';

-- AlterTable
ALTER TABLE "Rfp" ADD COLUMN     "award_date" TIMESTAMP(3),
ADD COLUMN     "award_notes" TEXT,
ADD COLUMN     "awarded_vendor_id" TEXT,
ADD COLUMN     "rejected_vendor_ids" JSONB NOT NULL DEFAULT '[]';
