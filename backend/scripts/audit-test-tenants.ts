/**
 * Reports tenants that look like leaked test fixtures or deploy probes, and how
 * much data hangs off each one.
 *
 * Deliberately READ-ONLY. 29 tables reference Tenant WITHOUT onDelete: Cascade,
 * so a plain tenant.delete() fails on a foreign key rather than cleaning up --
 * a delete script has to walk dependents in the right order, and getting that
 * order wrong on a shared database is not recoverable. So this script tells you
 * what is there and lets you decide; it never removes anything.
 *
 * Classification is by NAME PATTERN, which is a heuristic, not a fact. Read the
 * list before acting on it: a real customer called "Test Security Ltd" would
 * match, and a fixture with a realistic name would not.
 *
 *   npx ts-node -T scripts/audit-test-tenants.ts
 *   npx ts-node -T scripts/audit-test-tenants.ts --verbose   # per-table counts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Patterns seen in fixture and probe tenants actually present in this database.
 * Anchored where possible to reduce false positives.
 */
const FIXTURE_PATTERNS: { label: string; pattern: RegExp }[] = [
  { label: 'e2e fixture', pattern: /e2e/i },
  { label: 'forgot-password fixture', pattern: /forgotpw|wrongotp/i },
  { label: 'warm-up probe', pattern: /^warmup\d*/i },
  { label: 'timing probe', pattern: /^timingcheck\d*/i },
  { label: 'deploy probe', pattern: /^(deploy|live|hm|brevo)check\d*/i },
  { label: 'brevo probe', pattern: /^brevo\d+$/i },
  { label: 'generic probe', pattern: /^probeco[0-9a-f]+$/i },
  { label: 'credits/entitlements fixture', pattern: /^(credits|ent)-e2e-/i },
];

function classify(name: string, slug: string): string | null {
  for (const { label, pattern } of FIXTURE_PATTERNS) {
    if (pattern.test(name) || pattern.test(slug)) return label;
  }
  return null;
}

async function main() {
  const verbose = process.argv.includes('--verbose');

  const tenants = await prisma.tenant.findMany({
    select: { id: true, name: true, slug: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });

  const fixtures: { id: string; name: string; slug: string; label: string }[] =
    [];
  const keepers: { name: string; slug: string; createdAt: Date }[] = [];

  for (const tenant of tenants) {
    const label = classify(tenant.name, tenant.slug);
    if (label) {
      fixtures.push({ ...tenant, label });
    } else {
      keepers.push(tenant);
    }
  }

  console.log(
    `${tenants.length} tenant(s) total: ${fixtures.length} look like fixtures, ${keepers.length} do not.\n`,
  );

  console.log('--- NOT classified as fixtures (review these carefully) ---');
  for (const tenant of keepers) {
    console.log(
      `  ${tenant.name}  |  ${tenant.slug}  |  ${tenant.createdAt
        .toISOString()
        .slice(0, 10)}`,
    );
  }

  console.log('\n--- Look like fixtures ---');
  const byLabel = new Map<string, number>();
  for (const fixture of fixtures) {
    byLabel.set(fixture.label, (byLabel.get(fixture.label) ?? 0) + 1);
  }
  for (const [label, count] of byLabel) {
    console.log(`  ${count.toString().padStart(3)}  ${label}`);
  }

  if (!verbose) {
    console.log('\nRe-run with --verbose for per-tenant data counts.');
    return;
  }

  console.log('\n--- Data hanging off fixture tenants ---');
  let totals = { users: 0, leads: 0, guards: 0, invoices: 0, auditLogs: 0 };

  for (const fixture of fixtures) {
    const where = { tenantId: fixture.id };
    const [users, leads, guards, invoices, auditLogs] = await Promise.all([
      prisma.user.count({ where }),
      prisma.lead.count({ where }),
      prisma.guard.count({ where }),
      prisma.invoice.count({ where }),
      prisma.auditLog.count({ where }),
    ]);

    totals = {
      users: totals.users + users,
      leads: totals.leads + leads,
      guards: totals.guards + guards,
      invoices: totals.invoices + invoices,
      auditLogs: totals.auditLogs + auditLogs,
    };

    const rows = users + leads + guards + invoices + auditLogs;
    if (rows > 0) {
      console.log(
        `  ${fixture.slug}: users=${users} leads=${leads} guards=${guards} invoices=${invoices} audit=${auditLogs}`,
      );
    }
  }

  console.log(
    `\n  TOTAL across fixtures: users=${totals.users} leads=${totals.leads} ` +
      `guards=${totals.guards} invoices=${totals.invoices} audit=${totals.auditLogs}`,
  );
  console.log(
    '\nNOTE: 29 tables reference Tenant without onDelete: Cascade, so deleting a\n' +
      '      tenant requires removing dependents first. This script does not do that.',
  );
}

main()
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
