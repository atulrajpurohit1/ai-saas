-- Per-tenant auto-recharge: buy a credit pack automatically when the balance
-- falls below a threshold. Opt-in, bounded by a monthly cap, with every
-- attempt recorded because it charges a saved card unattended.

-- CreateEnum
CREATE TYPE "AutoRechargePauseReason" AS ENUM ('PAYMENT_FAILED', 'MONTHLY_CAP_REACHED');

-- CreateEnum
CREATE TYPE "AutoRechargeAttemptStatus" AS ENUM ('SUCCEEDED', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "CreditAutoRecharge" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "threshold_credits" INTEGER NOT NULL,
    "pack_key" TEXT NOT NULL,
    "stripe_payment_method_id" TEXT,
    "card_brand" TEXT,
    "card_last4" TEXT,
    "monthly_cap_amount" INTEGER,
    "paused_at" TIMESTAMP(3),
    "pause_reason" "AutoRechargePauseReason",
    "last_recharge_at" TIMESTAMP(3),
    "consecutive_failures" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditAutoRecharge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditAutoRechargeAttempt" (
    "id" TEXT NOT NULL,
    "config_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "status" "AutoRechargeAttemptStatus" NOT NULL,
    "balance_at_trigger" INTEGER NOT NULL,
    "pack_key" TEXT NOT NULL,
    "amount_charged" INTEGER,
    "credits_granted" INTEGER,
    "stripe_payment_intent_id" TEXT,
    "failure_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditAutoRechargeAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CreditAutoRecharge_tenant_id_key" ON "CreditAutoRecharge"("tenant_id");

-- CreateIndex
CREATE INDEX "CreditAutoRecharge_enabled_paused_at_idx" ON "CreditAutoRecharge"("enabled", "paused_at");

-- CreateIndex
CREATE UNIQUE INDEX "CreditAutoRechargeAttempt_stripe_payment_intent_id_key" ON "CreditAutoRechargeAttempt"("stripe_payment_intent_id");

-- CreateIndex
CREATE INDEX "CreditAutoRechargeAttempt_tenant_id_created_at_idx" ON "CreditAutoRechargeAttempt"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "CreditAutoRechargeAttempt_config_id_created_at_idx" ON "CreditAutoRechargeAttempt"("config_id", "created_at");

-- AddForeignKey
ALTER TABLE "CreditAutoRecharge" ADD CONSTRAINT "CreditAutoRecharge_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditAutoRechargeAttempt" ADD CONSTRAINT "CreditAutoRechargeAttempt_config_id_fkey" FOREIGN KEY ("config_id") REFERENCES "CreditAutoRecharge"("id") ON DELETE CASCADE ON UPDATE CASCADE;
