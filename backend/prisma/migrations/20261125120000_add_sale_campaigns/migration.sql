CREATE TABLE "SaleCampaign" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "percent_off" INTEGER NOT NULL,
    "package_keys" TEXT[] NOT NULL,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "stripe_coupon_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SaleCampaign_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SaleCampaign_enabled_starts_at_ends_at_idx"
ON "SaleCampaign"("enabled", "starts_at", "ends_at");
