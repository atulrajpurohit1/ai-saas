-- Adds User.module_welcomes_seen: which service welcomes a user has already
-- been shown. Per user, not per tenant, so a colleague added later still gets
-- their own and someone who has seen it does not get it again on a new device.
--
-- Additive and idempotent. `IF NOT EXISTS` because the column was already
-- applied by hand to some databases via
-- `backend/scripts/apply-module-welcomes-seen-column.ts`; this migration has
-- to be a no-op there rather than failing the deploy.
--
-- NOT NULL DEFAULT '{}' is required: Prisma types the field as a
-- non-nullable list, so a NULL would fail to deserialize on read and break
-- /users/me for every user predating the column. The empty-array default means
-- existing users are shown each welcome once and then never again.
--
-- The column is a Postgres array of the existing "ServiceModule" enum, so no
-- new type and no enum migration are needed.
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "module_welcomes_seen" "ServiceModule"[] NOT NULL DEFAULT '{}';
