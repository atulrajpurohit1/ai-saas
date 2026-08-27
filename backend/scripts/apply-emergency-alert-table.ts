// One-off, additive-only migration helper for Phase 3D (panic/duress
// alerts). Same rationale as Phase 3A/3B/3C: `prisma migrate dev` cannot run
// cleanly here because of PRE-EXISTING, unrelated drift that would
// otherwise prompt a full database reset. This script creates ONLY the new
// EmergencyAlert table, idempotently, matching exactly what Prisma's own
// generator would produce.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "EmergencyAlert" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "guard_id" TEXT NOT NULL,
    "branch_id" TEXT,
    "patrol_run_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "triggered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledged_at" TIMESTAMP(3),
    "resolved_at" TIMESTAMP(3),
    "acknowledged_by" TEXT,
    "resolved_by" TEXT,
    "notes" TEXT,
    "last_latitude" DOUBLE PRECISION,
    "last_longitude" DOUBLE PRECISION,
    "last_accuracy_meters" DOUBLE PRECISION,
    "location_captured_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmergencyAlert_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE INDEX IF NOT EXISTS "EmergencyAlert_tenant_id_idx" ON "EmergencyAlert"("tenant_id")`,
  `CREATE INDEX IF NOT EXISTS "EmergencyAlert_guard_id_idx" ON "EmergencyAlert"("guard_id")`,
  `CREATE INDEX IF NOT EXISTS "EmergencyAlert_branch_id_idx" ON "EmergencyAlert"("branch_id")`,
  `CREATE INDEX IF NOT EXISTS "EmergencyAlert_patrol_run_id_idx" ON "EmergencyAlert"("patrol_run_id")`,
  `CREATE INDEX IF NOT EXISTS "EmergencyAlert_status_idx" ON "EmergencyAlert"("status")`,
  `CREATE INDEX IF NOT EXISTS "EmergencyAlert_acknowledged_by_idx" ON "EmergencyAlert"("acknowledged_by")`,
  `CREATE INDEX IF NOT EXISTS "EmergencyAlert_resolved_by_idx" ON "EmergencyAlert"("resolved_by")`,
];

const FOREIGN_KEYS = [
  `ALTER TABLE "EmergencyAlert" ADD CONSTRAINT "EmergencyAlert_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
  `ALTER TABLE "EmergencyAlert" ADD CONSTRAINT "EmergencyAlert_guard_id_fkey" FOREIGN KEY ("guard_id") REFERENCES "Guard"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
  `ALTER TABLE "EmergencyAlert" ADD CONSTRAINT "EmergencyAlert_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE`,
  `ALTER TABLE "EmergencyAlert" ADD CONSTRAINT "EmergencyAlert_patrol_run_id_fkey" FOREIGN KEY ("patrol_run_id") REFERENCES "PatrolRun"("id") ON DELETE SET NULL ON UPDATE CASCADE`,
  `ALTER TABLE "EmergencyAlert" ADD CONSTRAINT "EmergencyAlert_acknowledged_by_fkey" FOREIGN KEY ("acknowledged_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE`,
  `ALTER TABLE "EmergencyAlert" ADD CONSTRAINT "EmergencyAlert_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE`,
];

async function main() {
  for (const sql of STATEMENTS) {
    console.log(`Running: ${sql.split('\n')[0]}...`);
    await prisma.$executeRawUnsafe(sql);
  }

  for (const sql of FOREIGN_KEYS) {
    const constraintName = sql.match(/CONSTRAINT "([^"]+)"/)?.[1];
    const existing = await prisma.$queryRawUnsafe<any[]>(
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
