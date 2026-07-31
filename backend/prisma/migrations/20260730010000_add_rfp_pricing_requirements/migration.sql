-- AlterTable
ALTER TABLE "Rfp" ADD COLUMN     "payment_terms" TEXT,
ADD COLUMN     "pricing_model" TEXT,
ADD COLUMN     "pricing_notes" TEXT,
ADD COLUMN     "pricing_validity" TEXT,
ADD COLUMN     "required_pricing_items" JSONB NOT NULL DEFAULT '[]';
