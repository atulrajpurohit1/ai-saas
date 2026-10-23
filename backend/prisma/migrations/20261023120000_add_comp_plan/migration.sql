-- Records which plan a comp granted, instead of inferring it from the modules.
--
-- The module set does not identify the plan. The Trial plan and the Complete
-- package both unlock all three services, so reverse-mapping a tenant's active
-- modules to a package named every Trial tenant "AegisLead Complete" -- on
-- their own billing page, where it read as a plan they never had -- while the
-- admin tenant list could only manage a bare "Comped" because the plan name
-- was no longer anywhere to be found.
--
-- Nullable with no default: null means "not a comp", which is right for every
-- paying tenant, and readers still fall back to deriving a name so a null here
-- degrades to the old behaviour rather than to a blank.

ALTER TABLE "TenantSubscription" ADD COLUMN "comp_plan" TEXT;

-- Backfill the comps that already exist, so the admin list and the billing page
-- name them correctly straight away rather than only for comps granted from now
-- on.
--
-- Two passes, because the two cases are recovered from different evidence and
-- the first is the one that matters: AI being off identifies the Trial plan
-- outright, and those are exactly the rows that were being mislabelled.
UPDATE "TenantSubscription"
SET "comp_plan" = 'TRIAL'
WHERE "source" = 'COMP' AND "ai_enabled" = false;

-- A comp WITH AI is a comped paid package, and for those the module set is
-- unambiguous -- Trial, the one plan it collides with, is already handled
-- above. A set matching no package (two of three, or none, as a revoked comp
-- has) is left null: there is no plan name to recover, and inventing one would
-- be worse than falling back.
WITH active AS (
  SELECT "tenant_id",
         array_agg(DISTINCT "module"::text ORDER BY "module"::text) AS modules
  FROM "TenantModule"
  WHERE "is_active" = true
  GROUP BY "tenant_id"
)
UPDATE "TenantSubscription" s
SET "comp_plan" = CASE a.modules
  WHEN ARRAY['FINANCE', 'GUARD_TOUR', 'LEAD_GEN'] THEN 'COMPLETE'
  WHEN ARRAY['LEAD_GEN'] THEN 'GENERATION'
  WHEN ARRAY['GUARD_TOUR'] THEN 'GUARD'
  WHEN ARRAY['FINANCE'] THEN 'OPERATIONS'
  ELSE NULL
END
FROM active a
WHERE a."tenant_id" = s."tenant_id"
  AND s."source" = 'COMP'
  AND s."ai_enabled" = true;
