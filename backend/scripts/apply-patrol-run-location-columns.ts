// One-off, additive-only migration helper for Phase 3B (live guard tracking).
// Same rationale as Phase 3A's apply-checkpoint-geofence-columns.ts:
// `prisma migrate dev` cannot run cleanly here because of PRE-EXISTING,
// unrelated drift (confirmed by the Phase 3A audit) that would otherwise
// prompt a full database reset. This script applies only the 4 new
// nullable columns this feature needs, directly and idempotently, and
// leaves everything else untouched.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const STATEMENTS = [
  `ALTER TABLE "PatrolRun" ADD COLUMN IF NOT EXISTS "last_latitude" DOUBLE PRECISION`,
  `ALTER TABLE "PatrolRun" ADD COLUMN IF NOT EXISTS "last_longitude" DOUBLE PRECISION`,
  `ALTER TABLE "PatrolRun" ADD COLUMN IF NOT EXISTS "last_accuracy_meters" DOUBLE PRECISION`,
  `ALTER TABLE "PatrolRun" ADD COLUMN IF NOT EXISTS "last_location_at" TIMESTAMP(3)`,
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
