// One-off, additive-only migration helper for Guard Tour QR verification.
// Follows the same pattern as apply-checkpoint-geofence-columns.ts:
// `prisma migrate dev` refuses to run against the live database because of
// PRE-EXISTING drift unrelated to this change and wants to reset the whole
// database to reconcile it, which is not acceptable. This script applies
// only the two new nullable columns this feature needs, directly, leaving
// all other data and the pre-existing drift untouched.
//
// Every statement is idempotent (IF NOT EXISTS) and purely additive
// (nullable columns only) - safe to re-run, and existing rows are unaffected.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const STATEMENTS = [
  `ALTER TABLE "PatrolEvent" ADD COLUMN IF NOT EXISTS "qr_verification_status" TEXT`,
  `ALTER TABLE "PatrolEvent" ADD COLUMN IF NOT EXISTS "submitted_qr_value" TEXT`,
];

async function main() {
  for (const sql of STATEMENTS) {
    console.log(`Running: ${sql}`);
    await prisma.$executeRawUnsafe(sql);
  }
  console.log(
    '\nDone. All statements are idempotent ADD COLUMN IF NOT EXISTS on nullable columns.',
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
