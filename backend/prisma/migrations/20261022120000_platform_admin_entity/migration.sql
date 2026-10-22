-- Separates the platform owner from tenant users.
--
-- Platform access used to be the `is_super_admin` boolean on "User", which
-- signup set to true for every tenant's founding user. The same column was
-- read by the platform guard, so every customer held a working platform-admin
-- token. The column stays, but from here it means only "owner of this tenant,
-- sees every branch in it"; platform authority lives in this new table and in
-- a separately-signed token.
--
-- Nothing here revokes `is_super_admin` from existing tenant users: that flag
-- is what lets a tenant owner see their own branches, and clearing it would
-- lock every existing owner out of their own account. It is now simply
-- powerless outside its own tenant.

CREATE TABLE "PlatformAdmin" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "refresh_token_hash" TEXT,
    "last_login_at" TIMESTAMP(3),
    "last_login_ip" TEXT,
    "failed_attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformAdmin_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlatformAdmin_email_key" ON "PlatformAdmin"("email");

-- Reversible tenant removal. Defaults keep every existing tenant active, so
-- this is additive: no tenant changes state when the migration runs.
ALTER TABLE "Tenant" ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Tenant" ADD COLUMN "suspended_at" TIMESTAMP(3);
ALTER TABLE "Tenant" ADD COLUMN "suspended_reason" TEXT;
