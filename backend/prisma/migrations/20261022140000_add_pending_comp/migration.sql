-- Lets a complimentary plan be queued behind a paid subscription.
--
-- Granting the free (Trial) plan used to take effect immediately, whatever the
-- tenant was already on. For a paying customer that is a downgrade nobody
-- asked for: a Trial grant switches AI off, flips `source` to COMP, and the
-- Stripe webhook then refuses to write to the tenant at all -- while Stripe
-- carries on charging them for the period they have already paid for.
--
-- So the grant is parked in these columns and applied when the paid plan ends:
-- either on the date recorded here, or when Stripe reports the cancellation,
-- whichever happens first.
--
-- All nullable with no default: a null `pending_comp_plan` means "nothing
-- queued", which is the correct state for every existing row. A comp granted
-- to a tenant with no live paid plan still applies immediately and never
-- touches these columns.
--
-- `pending_comp_days` holds the comp's term rather than an absolute expiry,
-- because the term runs from activation: a 30-day free plan queued behind two
-- months of paid service is still 30 days of free service.

ALTER TABLE "TenantSubscription"
  ADD COLUMN "pending_comp_plan" TEXT,
  ADD COLUMN "pending_comp_starts_at" TIMESTAMP(3),
  ADD COLUMN "pending_comp_days" INTEGER,
  ADD COLUMN "pending_comp_reason" TEXT,
  ADD COLUMN "pending_comp_granted_by" TEXT;

-- The activation sweep queries by start date.
CREATE INDEX "TenantSubscription_pending_comp_starts_at_idx"
  ON "TenantSubscription"("pending_comp_starts_at");
