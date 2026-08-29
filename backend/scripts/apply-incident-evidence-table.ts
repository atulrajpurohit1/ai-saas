// One-off, additive-only migration helper for Phase 3F (incident photo/video
// evidence). Same rationale as Phase 3A/3B/3C/3D: `prisma migrate dev` cannot
// be relied on here because of PRE-EXISTING, unrelated drift that would
// otherwise prompt a full database reset. This script creates ONLY the new
// IncidentEvidence table, idempotently, matching exactly what Prisma's own
// generator would produce (see the matching migration.sql).
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "IncidentEvidence" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "incident_id" TEXT NOT NULL,
    "media_type" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "stored_file_name" TEXT NOT NULL,
    "file_size_bytes" INTEGER NOT NULL,
    "uploaded_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IncidentEvidence_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE INDEX IF NOT EXISTS "IncidentEvidence_tenant_id_idx" ON "IncidentEvidence"("tenant_id")`,
  `CREATE INDEX IF NOT EXISTS "IncidentEvidence_incident_id_idx" ON "IncidentEvidence"("incident_id")`,
];

const FOREIGN_KEYS = [
  `ALTER TABLE "IncidentEvidence" ADD CONSTRAINT "IncidentEvidence_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
  `ALTER TABLE "IncidentEvidence" ADD CONSTRAINT "IncidentEvidence_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "Incident"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
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
