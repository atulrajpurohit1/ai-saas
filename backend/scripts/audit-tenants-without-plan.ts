/**
 * Reports which EXISTING tenants lose access once a plan is required.
 *
 * Run this BEFORE deploying PlanGuard. The rule is enforced live off the
 * database -- "has a plan" means "owns at least one active TenantModule row" --
 * so there is no migration to run and nothing to backfill: every tenant below
 * is locked the moment the new build ships. This script is how you find out who
 * that is while you can still do something about it.
 *
 * Deliberately READ-ONLY. It grants nothing and revokes nothing; comping or
 * provisioning a tenant is a decision for the platform console, not a script
 * that runs over every row at once.
 *
 * What each section means:
 *
 *   LOCKED  -- active subscription, zero modules. These accounts could use the
 *              CORE features (clients, sites, documents, notes, team members,
 *              API keys, integrations, dashboard) without paying. They are the
 *              point of the change, and they are also the ones most likely to
 *              complain, so look at how much data they have before shipping.
 *   NO ROW  -- no subscription row at all. Already fully locked today by
 *              EntitlementsService, which fails closed. Listed so the two
 *              broken states are not confused.
 *   LAPSED  -- a comp whose end date has passed, or a non-active status. Also
 *              already locked today, for the same reason.
 *   KEEPS   -- owns at least one module. Unaffected. Counted so the summary
 *              adds up and a surprising number here is visible.
 *
 *   npx ts-node -T scripts/audit-tenants-without-plan.ts
 *   npx ts-node -T scripts/audit-tenants-without-plan.ts --verbose
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const verbose = process.argv.includes('--verbose');

type Bucket = 'LOCKED' | 'NO ROW' | 'LAPSED' | 'KEEPS';

/**
 * Mirrors EntitlementsService.modulesForTenant. Kept as a copy rather than
 * importing the service, because the service needs the Nest container and this
 * runs as a plain script -- but it must stay in step, so any change to the
 * fail-closed rules there belongs here too.
 */
const ACTIVE_STATUSES = ['ACTIVE', 'TRIALING', 'PAST_DUE'];

function classify(tenant: {
  subscription: {
    status: string;
    source: string;
    compExpiresAt: Date | null;
  } | null;
  moduleCount: number;
}): Bucket {
  const subscription = tenant.subscription;
  if (!subscription) return 'NO ROW';
  if (!ACTIVE_STATUSES.includes(subscription.status)) return 'LAPSED';
  if (
    subscription.source === 'COMP' &&
    subscription.compExpiresAt &&
    subscription.compExpiresAt.getTime() <= Date.now()
  ) {
    return 'LAPSED';
  }
  return tenant.moduleCount > 0 ? 'KEEPS' : 'LOCKED';
}

/** DD-MM-YYYY, matching how dates are shown everywhere else in the product. */
function formatDate(value: Date | null): string {
  if (!value) return '-';
  const day = String(value.getDate()).padStart(2, '0');
  const month = String(value.getMonth() + 1).padStart(2, '0');
  return `${day}-${month}-${value.getFullYear()}`;
}

async function main() {
  const tenants = await prisma.tenant.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      createdAt: true,
      subscription: {
        select: { status: true, source: true, compExpiresAt: true },
      },
      _count: { select: { users: true, clients: true, sites: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  // Only ACTIVE module rows count, matching the entitlement read. A tenant
  // whose rows were all deactivated owns nothing.
  const moduleRows = await prisma.tenantModule.groupBy({
    by: ['tenantId'],
    where: { isActive: true },
    _count: { _all: true },
  });
  const moduleCountByTenant = new Map(
    moduleRows.map((row) => [row.tenantId, row._count._all]),
  );

  const buckets: Record<Bucket, typeof tenants> = {
    LOCKED: [],
    'NO ROW': [],
    LAPSED: [],
    KEEPS: [],
  };

  for (const tenant of tenants) {
    const bucket = classify({
      subscription: tenant.subscription,
      moduleCount: moduleCountByTenant.get(tenant.id) ?? 0,
    });
    buckets[bucket].push(tenant);
  }

  const report = (bucket: Bucket, explanation: string) => {
    const rows = buckets[bucket];
    console.log(`\n${bucket}  (${rows.length})  -- ${explanation}`);
    if (!rows.length) return;
    if (bucket === 'KEEPS' && !verbose) {
      console.log('  (run with --verbose to list these)');
      return;
    }

    for (const tenant of rows) {
      const counts = `${tenant._count.users} users, ${tenant._count.clients} clients, ${tenant._count.sites} sites`;
      console.log(
        `  ${tenant.name} [${tenant.slug}]  created ${formatDate(tenant.createdAt)}  ${counts}`,
      );
    }
  };

  console.log(`Tenants: ${tenants.length}`);
  report(
    'LOCKED',
    'ACTIVE with no modules -- these LOSE access when PlanGuard ships',
  );
  report('NO ROW', 'no subscription row -- already locked today');
  report('LAPSED', 'expired comp or inactive status -- already locked today');
  report('KEEPS', 'owns at least one module -- unaffected');

  // The number worth acting on. A LOCKED tenant with real data is a customer
  // conversation (comp them, or let them buy); a LOCKED tenant with none is
  // an abandoned signup and needs nothing.
  const withData = buckets.LOCKED.filter(
    (tenant) => tenant._count.clients > 0 || tenant._count.sites > 0,
  );
  console.log(
    `\n${withData.length} of the ${buckets.LOCKED.length} newly-locked tenants have real data (clients or sites).`,
  );
  if (withData.length) {
    console.log(
      'Decide these before deploying: comp them from the platform console, or tell them to pick a plan.',
    );
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
