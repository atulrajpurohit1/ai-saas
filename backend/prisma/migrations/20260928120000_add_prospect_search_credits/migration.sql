-- CreateEnum
CREATE TYPE "CreditEntryType" AS ENUM ('PURCHASE', 'RESERVATION', 'RELEASE', 'CONSUMPTION', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "CreditReservationStatus" AS ENUM ('PENDING', 'SETTLED', 'RELEASED');

-- CreateTable
CREATE TABLE "TenantCreditBalance" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "lifetime_purchased" INTEGER NOT NULL DEFAULT 0,
    "lifetime_consumed" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantCreditBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditLedgerEntry" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "type" "CreditEntryType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "balance_after" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "user_id" TEXT,
    "job_id" TEXT,
    "reservation_status" "CreditReservationStatus",
    "settled_amount" INTEGER,
    "settled_at" TIMESTAMP(3),
    "reservation_id" TEXT,
    "stripe_session_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TenantCreditBalance_tenant_id_key" ON "TenantCreditBalance"("tenant_id");
CREATE INDEX "TenantCreditBalance_tenant_id_idx" ON "TenantCreditBalance"("tenant_id");
CREATE UNIQUE INDEX "CreditLedgerEntry_stripe_session_id_key" ON "CreditLedgerEntry"("stripe_session_id");
CREATE INDEX "CreditLedgerEntry_tenant_id_idx" ON "CreditLedgerEntry"("tenant_id");
CREATE INDEX "CreditLedgerEntry_tenant_id_created_at_idx" ON "CreditLedgerEntry"("tenant_id", "created_at");
CREATE INDEX "CreditLedgerEntry_tenant_id_type_idx" ON "CreditLedgerEntry"("tenant_id", "type");

-- A tenant can hold at most one reservation per BlackPearl job, so a retried
-- submit cannot double-hold credits for the same job.
CREATE UNIQUE INDEX "CreditLedgerEntry_tenant_id_job_id_type_key" ON "CreditLedgerEntry"("tenant_id", "job_id", "type");

-- AddForeignKey
ALTER TABLE "TenantCreditBalance" ADD CONSTRAINT "TenantCreditBalance_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreditLedgerEntry" ADD CONSTRAINT "CreditLedgerEntry_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreditLedgerEntry" ADD CONSTRAINT "CreditLedgerEntry_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "CreditLedgerEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
