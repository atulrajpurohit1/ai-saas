-- Lets the platform owner grant plan access without a payment behind it.
--
-- `source` records WHY a tenant is entitled, which until now was inferrable
-- only from a missing provider id -- too weak to act on. The Stripe webhook
-- reads it to leave comped tenants alone; without that, a single subscription
-- event would reset a comp's modules and the customer would just lose access.
--
-- Existing rows all predate comping and are backed by Stripe (or by manual
-- provisioning that Stripe is expected to take over), so STRIPE is the correct
-- default and the correct backfill. The column is NOT NULL with a default
-- rather than nullable: "unknown provenance" is not a state worth modelling.
--
-- Nothing here touches credits. Plan entitlement and the credit ledger are
-- separate systems, and a comp deliberately grants the first and not the
-- second.

CREATE TYPE "SubscriptionSource" AS ENUM ('STRIPE', 'COMP');

ALTER TABLE "TenantSubscription"
  ADD COLUMN "source" "SubscriptionSource" NOT NULL DEFAULT 'STRIPE',
  ADD COLUMN "comp_expires_at" TIMESTAMP(3),
  ADD COLUMN "comp_reason" TEXT,
  ADD COLUMN "comp_granted_by" TEXT;

CREATE INDEX "TenantSubscription_source_idx" ON "TenantSubscription"("source");
