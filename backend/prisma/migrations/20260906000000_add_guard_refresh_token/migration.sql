-- Phase 5 guard-portal refresh-token flow.
-- The `Guard.refreshToken` field (@map("refresh_token")) was added to the Prisma
-- schema and is used by GuardAuthService (login / refresh / logout), but no
-- migration was ever generated for it, so guard login failed at runtime with
-- Prisma P2022 ("The column `Guard.refresh_token` does not exist").
-- Additive, nullable, idempotent.
ALTER TABLE "Guard" ADD COLUMN IF NOT EXISTS "refresh_token" TEXT;
