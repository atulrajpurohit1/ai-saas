ALTER TABLE "SaleCampaign" ADD COLUMN "bonus_credits" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "SaleCampaign" ALTER COLUMN "stripe_coupon_id" DROP NOT NULL;

CREATE TABLE "SaleCheckoutOffer" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "campaign_name" TEXT NOT NULL,
    "package_key" TEXT NOT NULL,
    "bonus_credits" INTEGER NOT NULL,
    "stripe_session_id" TEXT NOT NULL,
    "provider_subscription_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SaleCheckoutOffer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SaleCheckoutOffer_stripe_session_id_key" ON "SaleCheckoutOffer"("stripe_session_id");
CREATE UNIQUE INDEX "SaleCheckoutOffer_provider_subscription_id_key" ON "SaleCheckoutOffer"("provider_subscription_id");
CREATE INDEX "SaleCheckoutOffer_tenant_id_campaign_id_idx" ON "SaleCheckoutOffer"("tenant_id", "campaign_id");
ALTER TABLE "SaleCheckoutOffer" ADD CONSTRAINT "SaleCheckoutOffer_tenant_id_fkey"
FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
