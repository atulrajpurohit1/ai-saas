-- Tracks which credit-balance warnings a tenant has already been sent, so an
-- hourly sweep notifies once per drain cycle instead of once per tick.

-- CreateEnum
CREATE TYPE "CreditAlertTier" AS ENUM ('LOW', 'DEPLETED');

-- CreateTable
CREATE TABLE "CreditBalanceAlert" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "tier" "CreditAlertTier" NOT NULL,
    "balance_at_alert" INTEGER NOT NULL,
    "cleared_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditBalanceAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CreditBalanceAlert_tenant_id_tier_cleared_at_idx" ON "CreditBalanceAlert"("tenant_id", "tier", "cleared_at");

-- Belt-and-braces for the "one open alert per tier" rule the service relies
-- on. Prisma cannot express a partial unique index, so it is declared here:
-- without it, two concurrent sweeps could both insert an open alert and send
-- two emails.
CREATE UNIQUE INDEX "CreditBalanceAlert_open_unique" ON "CreditBalanceAlert"("tenant_id", "tier") WHERE "cleared_at" IS NULL;

-- AddForeignKey
ALTER TABLE "CreditBalanceAlert" ADD CONSTRAINT "CreditBalanceAlert_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
