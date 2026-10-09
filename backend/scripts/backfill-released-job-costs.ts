/**
 * Recovers what BlackPearl charged for Prospect Search jobs that were refunded
 * with no cost recorded.
 *
 * Until AbandonedJobScheduler existed, a search the page stopped waiting for
 * was released blind by the hourly sweep, so its upstream cost was never read.
 * BlackPearl still has those jobs, so the cost can be fetched now and written
 * onto the hold -- the customer stays refunded; only our record of what the
 * job cost us changes.
 *
 * Dry run by default: prints what each job cost and what would be written.
 * Seeded demo jobs (demo-job-*) are skipped; BlackPearl has never seen them.
 *
 *   npx ts-node -T scripts/backfill-released-job-costs.ts
 *   npx ts-node -T scripts/backfill-released-job-costs.ts --apply
 *
 * Needs DATABASE_URL and BLACKPEARL_API_KEY (and BLACKPEARL_BASE_URL if not
 * the default), read from .env.
 */
import * as dotenv from 'dotenv';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { BlackPearlProspectingProvider } from '../src/prospect-search/providers/blackpearl-prospecting.provider';

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  const apply = process.argv.includes('--apply');

  if (!process.env.BLACKPEARL_API_KEY) {
    throw new Error('BLACKPEARL_API_KEY is not set; cannot read job costs.');
  }

  const provider = new BlackPearlProspectingProvider({
    get: (key: string) => process.env[key],
  } as unknown as ConfigService);

  const holds = await prisma.creditLedgerEntry.findMany({
    where: {
      type: 'RESERVATION',
      reservationStatus: 'RELEASED',
      upstreamCostUsd: null,
      jobId: { not: null },
      NOT: { jobId: { startsWith: 'demo-' } },
    },
    select: { id: true, jobId: true, createdAt: true, description: true },
    orderBy: { createdAt: 'asc' },
  });

  if (!holds.length) {
    console.log('No refunded jobs are missing a cost; nothing to do.');
    return;
  }

  let total = 0;
  let found = 0;

  for (const hold of holds) {
    const outcome = await provider.getJobOutcome(hold.jobId as string);
    const label = `${hold.createdAt.toISOString().slice(0, 16)}  ${hold.jobId}`;

    if (!outcome) {
      console.log(`${label}  could not read job from BlackPearl`);
      continue;
    }
    if (outcome.upstreamCostUsd === null) {
      console.log(`${label}  ${outcome.status}, no cost reported`);
      continue;
    }

    found += 1;
    total += outcome.upstreamCostUsd;
    console.log(
      `${label}  ${outcome.status}, cost $${outcome.upstreamCostUsd.toFixed(2)}  ${hold.description}`,
    );

    if (apply) {
      // Guarded on the cost still being null, so a re-run never overwrites.
      await prisma.creditLedgerEntry.updateMany({
        where: { id: hold.id, upstreamCostUsd: null },
        data: { upstreamCostUsd: outcome.upstreamCostUsd },
      });
    }
  }

  console.log(
    `\n${found} of ${holds.length} job(s) had a cost, totalling $${total.toFixed(2)}.` +
      (apply
        ? ' Written to the ledger.'
        : ' Dry run; re-run with --apply to write.'),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
