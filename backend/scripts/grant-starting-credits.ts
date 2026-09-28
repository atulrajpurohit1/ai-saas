/**
 * Grants a starting Prospect Search credit balance to tenants that already own
 * AegisLead Generation.
 *
 * Credits shipped after those tenants had already bought Lead Gen, so without
 * this every Prospect Search would answer 402 on the day the feature goes live.
 * This is a one-off goodwill top-up, not part of the purchase flow.
 *
 * Idempotent: a tenant that already has a balance row is skipped, so re-running
 * this never stacks grants. Run with --force to grant regardless (useful if you
 * deliberately want to top everyone up again).
 *
 * Pass --slug to target specific tenants, which is almost always what you want:
 * a shared database accumulates test fixtures and deploy probes, and those are
 * not customers who should be given credits.
 *
 *   npx ts-node -T scripts/grant-starting-credits.ts                      # dry run, all Lead Gen tenants
 *   npx ts-node -T scripts/grant-starting-credits.ts --slug=leadgen-demo --apply
 *   npx ts-node -T scripts/grant-starting-credits.ts --slug=a,b --apply --amount=500
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEFAULT_AMOUNT = 250;

function arg(name: string): string | undefined {
  const match = process.argv.find((value) => value.startsWith(`--${name}=`));
  return match?.split('=')[1];
}

async function main() {
  const apply = process.argv.includes('--apply');
  const force = process.argv.includes('--force');
  const parsed = Number.parseInt(arg('amount') ?? '', 10);
  const amount = Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_AMOUNT;

  const slugs = (arg('slug') ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  const tenants = await prisma.tenant.findMany({
    where: {
      modules: { some: { module: 'LEAD_GEN', isActive: true } },
      ...(slugs.length ? { slug: { in: slugs } } : {}),
    },
    select: {
      id: true,
      name: true,
      creditBalance: { select: { balance: true, lifetimePurchased: true } },
    },
    orderBy: { name: 'asc' },
  });

  if (!tenants.length) {
    console.log(
      slugs.length
        ? `No Lead Gen tenant matches: ${slugs.join(', ')}`
        : 'No tenants own AegisLead Generation; nothing to grant.',
    );
    return;
  }

  if (!slugs.length && tenants.length > 5) {
    console.log(
      `NOTE: targeting all ${tenants.length} Lead Gen tenants. A shared database ` +
        'usually holds test fixtures too -- pass --slug=<slug>[,<slug>] to grant ' +
        'only to real accounts.\n',
    );
  }

  console.log(
    `${tenants.length} tenant(s) own Lead Gen. Granting ${amount} credit(s) each.\n`,
  );

  let granted = 0;
  let skipped = 0;

  for (const tenant of tenants) {
    // A tenant that has ever had a balance has already been seeded (or has
    // bought credits), so granting again would be a second free top-up.
    const alreadySeeded = tenant.creditBalance !== null;

    if (alreadySeeded && !force) {
      console.log(
        `  SKIP  ${tenant.name} — already has a balance (${tenant.creditBalance?.balance} credits)`,
      );
      skipped += 1;
      continue;
    }

    if (!apply) {
      console.log(`  WOULD GRANT  ${tenant.name} — ${amount} credits`);
      granted += 1;
      continue;
    }

    // Mirrors CreditsService.grant(): balance and ledger row in one
    // transaction, so the ledger always sums to the balance.
    await prisma.$transaction(async (tx) => {
      const balance = await tx.tenantCreditBalance.upsert({
        where: { tenantId: tenant.id },
        create: {
          tenantId: tenant.id,
          balance: amount,
          lifetimePurchased: amount,
        },
        update: {
          balance: { increment: amount },
          lifetimePurchased: { increment: amount },
        },
        select: { balance: true },
      });

      await tx.creditLedgerEntry.create({
        data: {
          tenantId: tenant.id,
          type: 'ADJUSTMENT',
          amount,
          balanceAfter: balance.balance,
          description: `Starting Prospect Search credit balance (${amount}).`,
        },
      });
    });

    console.log(`  GRANTED  ${tenant.name} — ${amount} credits`);
    granted += 1;
  }

  console.log(
    `\n${apply ? 'Granted' : 'Would grant'} ${granted}, skipped ${skipped}.`,
  );
  if (!apply) {
    console.log('Dry run — re-run with --apply to make these changes.');
  }
}

main()
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
