// One-off, additive-only migration helper for Phase 3C (guard compliance).
// Same rationale as Phase 3A/3B: `prisma migrate dev` cannot run cleanly
// here because of PRE-EXISTING, unrelated drift (confirmed by prior
// audits) that would otherwise prompt a full database reset. This script
// creates ONLY the new GuardCompliance table, idempotently, matching
// exactly what Prisma's own generator would produce (verified against an
// existing CREATE TABLE migration for naming convention).
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "GuardCompliance" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "guard_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "document_number" TEXT,
    "issuing_authority" TEXT,
    "issue_date" TIMESTAMP(3),
    "expiration_date" TIMESTAMP(3),
    "notes" TEXT,
    "file_name" TEXT,
    "stored_file_name" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuardCompliance_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE INDEX IF NOT EXISTS "GuardCompliance_tenant_id_idx" ON "GuardCompliance"("tenant_id")`,
  `CREATE INDEX IF NOT EXISTS "GuardCompliance_guard_id_idx" ON "GuardCompliance"("guard_id")`,
  `CREATE INDEX IF NOT EXISTS "GuardCompliance_type_idx" ON "GuardCompliance"("type")`,
  `CREATE INDEX IF NOT EXISTS "GuardCompliance_expiration_date_idx" ON "GuardCompliance"("expiration_date")`,
];

const FOREIGN_KEYS = [
  `ALTER TABLE "GuardCompliance" ADD CONSTRAINT "GuardCompliance_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
  `ALTER TABLE "GuardCompliance" ADD CONSTRAINT "GuardCompliance_guard_id_fkey" FOREIGN KEY ("guard_id") REFERENCES "Guard"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
];

async function main() {
  for (const sql of STATEMENTS) {
    console.log(`Running: ${sql.split('\n')[0]}...`);
    await prisma.$executeRawUnsafe(sql);
  }

  for (const sql of FOREIGN_KEYS) {
    const existing = await prisma.$queryRawUnsafe<any[]>(
      `SELECT 1 FROM pg_constraint WHERE conname = $1`,
      sql.match(/CONSTRAINT "([^"]+)"/)?.[1],
    );
    if (existing.length > 0) {
      console.log('Skipping (already exists):', sql.match(/CONSTRAINT "([^"]+)"/)?.[1]);
      continue;
    }
    console.log(`Running: ${sql}`);
    await prisma.$executeRawUnsafe(sql);
  }

  console.log('\nDone.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
