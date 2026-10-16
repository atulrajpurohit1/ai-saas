-- is_super_admin defaulted to TRUE, so any code path that created a user
-- without naming the flag minted a full tenant super admin. Only
-- AuthService.register relied on it, and it wants that explicitly; every other
-- creator (UsersService.create takes a raw Prisma input) would have inherited
-- the unsafe value by forgetting to think about it.
--
-- This is the same landmine already removed from AuthService.getTokens, where
-- the isSuperAdmin argument used to default to true.
--
-- Existing rows are untouched: this changes only what a new row gets when the
-- column is omitted.

ALTER TABLE "User" ALTER COLUMN "is_super_admin" SET DEFAULT false;
