/**
 * Adds User.module_welcomes_seen - which service welcomes a user has already
 * been shown.
 *
 * Additive-only migration helper, same rationale as the other apply-*.ts
 * scripts here: `prisma migrate dev` cannot run cleanly against this database
 * because of PRE-EXISTING, unrelated drift that would otherwise prompt a full
 * reset. This applies only the one new column, directly and idempotently, and
 * leaves everything else untouched.
 *
 * Safe to run against a live database and safe to run twice:
 *
 *   - ADD COLUMN IF NOT EXISTS, so a re-run is a no-op.
 *   - NOT NULL DEFAULT '{}', so existing rows get an empty array rather than
 *     NULL. Prisma types this field as a non-nullable list and a NULL would
 *     fail to deserialize on read, which would break /users/me for every user
 *     that predates this column.
 *   - The default is the empty array, so every existing user is shown each
 *     welcome once and then never again. Back-filling it as "already seen"
 *     would be the other defensible choice; showing it once is the point of
 *     the feature, and these are three dialogs across the life of an account.
 *
 * The column is a Postgres array of the existing ServiceModule enum type, so
 * it needs no new type and no enum migration.
 *
 *   npx ts-node -T scripts/apply-module-welcomes-seen-column.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const STATEMENTS = [
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "module_welcomes_seen" "ServiceModule"[] NOT NULL DEFAULT '{}'`,
];

async function main() {
  for (const sql of STATEMENTS) {
    console.log(`Running: ${sql}`);
    await prisma.$executeRawUnsafe(sql);
  }

  // Read it back rather than trusting the DDL silently: a column that exists
  // but cannot be selected (wrong type, wrong name) would otherwise only show
  // up as a runtime failure on the next /users/me.
  const [check] = await prisma.$queryRawUnsafe<
    { data_type: string; is_nullable: string; column_default: string | null }[]
  >(
    `SELECT data_type, is_nullable, column_default
       FROM information_schema.columns
      WHERE table_name = 'User' AND column_name = 'module_welcomes_seen'`,
  );

  if (!check) {
    throw new Error(
      'module_welcomes_seen is missing after the ALTER. Nothing was applied.',
    );
  }

  console.log(
    `\nVerified: type=${check.data_type} nullable=${check.is_nullable} default=${check.column_default}`,
  );
  console.log(
    'Done. Idempotent ADD COLUMN IF NOT EXISTS; existing users start with no welcomes seen.',
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
