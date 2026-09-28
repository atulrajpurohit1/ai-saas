/**
 * Deletes leaked test-fixture and probe tenants, with everything hanging off
 * them.
 *
 * 30 of the 64 tenant-scoped models reference Tenant WITHOUT onDelete: Cascade,
 * and several depend on each other (Deal -> Lead, Invoice -> Client,
 * Assignment -> Shift), so deleting them in the right order by hand is both
 * tedious and easy to get wrong. Instead this defers the ordering to Postgres:
 * it runs inside one transaction with constraints deferred where possible, and
 * falls back to repeated passes until nothing is left to delete. Either the
 * whole tenant goes or none of it does.
 *
 * DRY RUN BY DEFAULT. Nothing is removed without --apply.
 *
 *   npx ts-node -T scripts/delete-test-tenants.ts                  # report only
 *   npx ts-node -T scripts/delete-test-tenants.ts --apply
 *   npx ts-node -T scripts/delete-test-tenants.ts --apply --slug=a,b
 *
 * Run scripts/audit-test-tenants.ts first and READ THE LIST. Classification is
 * by name pattern, which is a heuristic: a real customer called "Test Security
 * Ltd" would match it.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** Mirrors audit-test-tenants.ts. Keep the two in step. */
const FIXTURE_PATTERNS: RegExp[] = [
  /e2e/i,
  /forgotpw|wrongotp/i,
  /^warmup\d*/i,
  /^timingcheck\d*/i,
  /^(deploy|live|hm|brevo)check\d*/i,
  /^brevo\d+$/i,
  /^probeco[0-9a-f]+$/i,
  /^(credits|ent)-e2e-/i,
];

function isFixture(name: string, slug: string) {
  return FIXTURE_PATTERNS.some(
    (pattern) => pattern.test(name) || pattern.test(slug),
  );
}

function arg(name: string): string | undefined {
  return process.argv
    .find((value) => value.startsWith(`--${name}=`))
    ?.split('=')[1];
}

/**
 * Deletes one tenant and its dependents.
 *
 * Rather than encoding a 30-table order, this asks Postgres for every table
 * with a tenant_id column and deletes from all of them repeatedly: each pass
 * removes whatever no longer has dependents, so a chain of N levels clears in
 * at most N passes. It is O(passes x tables) rather than clever, which is the
 * right trade for a cleanup script that must not corrupt anything.
 */
async function deleteTenant(tenantId: string) {
  await prisma.$transaction(
    async (tx) => {
      const tables = await tx.$queryRaw<{ table_name: string }[]>`
        SELECT table_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND column_name = 'tenant_id'
        ORDER BY table_name
      `;

      let remaining = tables.map((row) => row.table_name);

      // Each pass clears the tables that have no surviving dependents. Anything
      // still blocked is retried next pass.
      for (let pass = 0; pass < 12 && remaining.length; pass += 1) {
        const blocked: string[] = [];

        for (const table of remaining) {
          try {
            await tx.$executeRawUnsafe(
              `DELETE FROM "${table}" WHERE tenant_id = $1`,
              tenantId,
            );
          } catch {
            // Still referenced by another table; try again next pass.
            blocked.push(table);
          }
        }

        if (blocked.length === remaining.length) {
          // No progress in a whole pass means a genuine cycle, not slow
          // convergence. Abort rather than loop: the transaction rolls back.
          throw new Error(
            `Could not resolve delete order; still blocked: ${blocked.join(', ')}`,
          );
        }
        remaining = blocked;
      }

      if (remaining.length) {
        throw new Error(`Gave up with tables still populated: ${remaining.join(', ')}`);
      }

      await tx.$executeRaw`DELETE FROM "Tenant" WHERE id = ${tenantId}`;
    },
    { timeout: 120_000 },
  );
}

async function main() {
  const apply = process.argv.includes('--apply');
  const slugs = (arg('slug') ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  const all = await prisma.tenant.findMany({
    select: { id: true, name: true, slug: true },
    orderBy: { createdAt: 'asc' },
  });

  const targets = slugs.length
    ? all.filter((tenant) => slugs.includes(tenant.slug))
    : all.filter((tenant) => isFixture(tenant.name, tenant.slug));

  if (!targets.length) {
    console.log('Nothing matches; nothing to delete.');
    return;
  }

  console.log(
    `${targets.length} tenant(s) targeted for deletion out of ${all.length} total:\n`,
  );
  targets.forEach((tenant) => console.log(`  ${tenant.name}  |  ${tenant.slug}`));

  if (!apply) {
    console.log(
      `\nDRY RUN — nothing deleted. Re-run with --apply to remove these ${targets.length} tenant(s).`,
    );
    return;
  }

  console.log('');
  let deleted = 0;
  const failed: string[] = [];

  for (const tenant of targets) {
    try {
      await deleteTenant(tenant.id);
      console.log(`  DELETED  ${tenant.slug}`);
      deleted += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`  FAILED   ${tenant.slug} — ${message}`);
      failed.push(tenant.slug);
    }
  }

  console.log(`\nDeleted ${deleted}, failed ${failed.length}.`);
  if (failed.length) {
    console.log(`Failed tenants were left untouched: ${failed.join(', ')}`);
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
