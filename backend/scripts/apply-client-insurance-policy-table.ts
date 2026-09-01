// One-off, additive-only migration helper for Phase 3G (client / site
// insurance & COI compliance). Same rationale as Phase 3A/3B/3C/3D/3F:
// `prisma migrate dev` cannot be relied on here because of PRE-EXISTING,
// unrelated drift that would otherwise prompt a full database reset. This
// script creates ONLY the new ClientInsurancePolicy table, idempotently,
// matching exactly what Prisma's own generator would produce (see the
// matching migration.sql).
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "ClientInsurancePolicy" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "site_id" TEXT,
    "type" TEXT NOT NULL,
    "policy_number" TEXT,
    "insurer" TEXT,
    "coverage_amount" DOUBLE PRECISION,
    "effective_date" TIMESTAMP(3),
    "expiration_date" TIMESTAMP(3),
    "notes" TEXT,
    "file_name" TEXT,
    "stored_file_name" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientInsurancePolicy_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE INDEX IF NOT EXISTS "ClientInsurancePolicy_tenant_id_idx" ON "ClientInsurancePolicy"("tenant_id")`,
  `CREATE INDEX IF NOT EXISTS "ClientInsurancePolicy_client_id_idx" ON "ClientInsurancePolicy"("client_id")`,
  `CREATE INDEX IF NOT EXISTS "ClientInsurancePolicy_site_id_idx" ON "ClientInsurancePolicy"("site_id")`,
  `CREATE INDEX IF NOT EXISTS "ClientInsurancePolicy_type_idx" ON "ClientInsurancePolicy"("type")`,
  `CREATE INDEX IF NOT EXISTS "ClientInsurancePolicy_expiration_date_idx" ON "ClientInsurancePolicy"("expiration_date")`,
];

const FOREIGN_KEYS = [
  `ALTER TABLE "ClientInsurancePolicy" ADD CONSTRAINT "ClientInsurancePolicy_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
  `ALTER TABLE "ClientInsurancePolicy" ADD CONSTRAINT "ClientInsurancePolicy_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
  `ALTER TABLE "ClientInsurancePolicy" ADD CONSTRAINT "ClientInsurancePolicy_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE`,
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
