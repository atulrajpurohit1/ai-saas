// One-off, additive-only migration helper for Phase 3A (GPS geofence).
// `prisma migrate dev` refuses to run here because the live database has
// PRE-EXISTING drift unrelated to this change (CrmConnection/CrmIntegration*
// tables and a dropped SCIMConfig table with no recorded migration) and
// wants to reset the whole database to reconcile it. That is not
// acceptable — this script instead applies only the new nullable columns
// this feature needs, directly, leaving all other data and the pre-existing
// drift untouched.
//
// Every statement is idempotent (IF NOT EXISTS) and purely additive
// (nullable columns only) — safe to re-run, and existing rows are
// unaffected.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const STATEMENTS = [
  `ALTER TABLE "Checkpoint" ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION`,
  `ALTER TABLE "Checkpoint" ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION`,
  `ALTER TABLE "Checkpoint" ADD COLUMN IF NOT EXISTS "geofence_radius_meters" INTEGER`,
  `ALTER TABLE "PatrolEvent" ADD COLUMN IF NOT EXISTS "verification_status" TEXT`,
  `ALTER TABLE "PatrolEvent" ADD COLUMN IF NOT EXISTS "distance_meters" DOUBLE PRECISION`,
  `ALTER TABLE "PatrolEvent" ADD COLUMN IF NOT EXISTS "submitted_latitude" DOUBLE PRECISION`,
  `ALTER TABLE "PatrolEvent" ADD COLUMN IF NOT EXISTS "submitted_longitude" DOUBLE PRECISION`,
];

async function main() {
  for (const sql of STATEMENTS) {
    console.log(`Running: ${sql}`);
    await prisma.$executeRawUnsafe(sql);
  }
  console.log('\nDone. All statements are idempotent ADD COLUMN IF NOT EXISTS on nullable columns.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
