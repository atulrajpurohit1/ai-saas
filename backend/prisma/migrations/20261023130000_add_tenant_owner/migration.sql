-- Records each tenant's founding user, so it can be protected from demotion.
--
-- An account owner who was assigned a lesser role lost Super Admin and every
-- user/role-management permission with it, and could not restore it from
-- inside the app -- the account was locked out of its own administration. The
-- fix needs a durable answer to "who is the owner", and inferring it from
-- is_super_admin does not work once more than one user holds that flag.
--
-- Nullable, and NOT a foreign key on purpose: deleting any other user must
-- never cascade into or null this column, and the value is only ever compared
-- by id. Null means "not yet resolved" -- the owner row during creation, or a
-- legacy tenant the backfill below could not match.

ALTER TABLE "Tenant" ADD COLUMN "owner_user_id" TEXT;

-- Backfill every existing tenant to its founding user: the earliest-created
-- user, preferring one that already holds is_super_admin (the owner always
-- did at creation). DISTINCT ON keeps exactly the first row per tenant in that
-- order, which is that user.
UPDATE "Tenant" t
SET "owner_user_id" = sub.id
FROM (
  SELECT DISTINCT ON ("tenantId") "tenantId", "id"
  FROM "User"
  ORDER BY "tenantId", "is_super_admin" DESC, "createdAt" ASC
) sub
WHERE sub."tenantId" = t."id";
