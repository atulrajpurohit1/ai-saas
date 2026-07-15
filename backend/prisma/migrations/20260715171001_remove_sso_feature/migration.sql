-- DropForeignKey
ALTER TABLE "UserSession" DROP CONSTRAINT IF EXISTS "UserSession_provider_id_fkey";

-- DropIndex
DROP INDEX IF EXISTS "UserSession_provider_id_idx";

-- AlterTable
ALTER TABLE "UserSession" DROP COLUMN IF EXISTS "provider_id";

-- DropTable
DROP TABLE IF EXISTS "SSORoleMapping" CASCADE;

-- DropTable
DROP TABLE IF EXISTS "SSOLoginState" CASCADE;

-- DropTable
DROP TABLE IF EXISTS "SSOProvider" CASCADE;
