// One-off, additive-only migration helper for Phase 5 (guard portal refresh
// token flow). Same rationale as the Phase 3 apply-*-columns.ts scripts:
// `prisma migrate dev` cannot run cleanly here because of PRE-EXISTING,
// unrelated drift that would otherwise prompt a full database reset. This
// script applies only the single new nullable column this feature needs,
// directly and idempotently, and leaves everything else untouched.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const STATEMENTS = [
  `ALTER TABLE "Guard" ADD COLUMN IF NOT EXISTS "refresh_token" TEXT`,
];

async function main() {
  for (const sql of STATEMENTS) {
    console.log(`Running: ${sql}`);
    await prisma.$executeRawUnsafe(sql);
  }
  console.log(
    '\nDone. Statement is an idempotent ADD COLUMN IF NOT EXISTS on a nullable column.',
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
