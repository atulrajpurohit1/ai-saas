// One-off, additive-only migration helper for Phase 3H (security RFP
// requirement analysis). Same rationale as Phase 3A-3G: `prisma migrate dev`
// cannot be relied on here because of PRE-EXISTING, unrelated drift that would
// otherwise prompt a full database reset. This script creates ONLY the new
// RfpRequirementAnalysis table, idempotently, matching exactly what Prisma's
// own generator would produce (see the matching migration.sql).
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "RfpRequirementAnalysis" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "rfp_id" TEXT NOT NULL,
    "requirements" JSONB NOT NULL DEFAULT '[]',
    "summary" TEXT NOT NULL,
    "missing_information" JSONB NOT NULL DEFAULT '[]',
    "model_used" TEXT NOT NULL,
    "fallback_used" BOOLEAN NOT NULL DEFAULT false,
    "safety_status" TEXT NOT NULL DEFAULT 'passed',
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RfpRequirementAnalysis_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE INDEX IF NOT EXISTS "RfpRequirementAnalysis_tenant_id_idx" ON "RfpRequirementAnalysis"("tenant_id")`,
  `CREATE INDEX IF NOT EXISTS "RfpRequirementAnalysis_rfp_id_idx" ON "RfpRequirementAnalysis"("rfp_id")`,
];

const FOREIGN_KEYS = [
  `ALTER TABLE "RfpRequirementAnalysis" ADD CONSTRAINT "RfpRequirementAnalysis_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
  `ALTER TABLE "RfpRequirementAnalysis" ADD CONSTRAINT "RfpRequirementAnalysis_rfp_id_fkey" FOREIGN KEY ("rfp_id") REFERENCES "Rfp"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
];

async function main() {
  for (const sql of STATEMENTS) {
    console.log(`Running: ${sql.split('\n')[0]}...`);
    await prisma.$executeRawUnsafe(sql);
  }

  for (const sql of FOREIGN_KEYS) {
    const constraintName = sql.match(/CONSTRAINT "([^"]+)"/)?.[1];
    const existing = await prisma.$queryRawUnsafe<unknown[]>(
      `SELECT 1 FROM pg_constraint WHERE conname = $1`,
      constraintName,
    );
    if (existing.length > 0) {
      console.log('Skipping (already exists):', constraintName);
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
