-- Adds a per-tenant AI (Gemini) kill-switch to the subscription.
--
-- The "AegisLead Trial Plan" grants the whole product EXCEPT the AI features.
-- That cannot be expressed as a module list, because AI features are spread
-- across every module (guard daily-report summaries, finance revenue
-- intelligence, sales/RFP generation), so withholding a module would withhold
-- the non-AI feature alongside the AI one. It also cannot be enforced through
-- credits, because a Trial tenant is allowed to buy credits for prospect
-- search, and the same balance pays for AI calls -- so credits are not the
-- gate. An explicit flag is.
--
-- NOT NULL with a default of true: every existing row predates the Trial plan
-- and is either paying or a comp of a real plan, all of which include AI, so
-- true is the correct backfill and the correct default. "AI off" is only ever
-- set deliberately, by a Trial grant.

ALTER TABLE "TenantSubscription"
  ADD COLUMN "ai_enabled" BOOLEAN NOT NULL DEFAULT true;
