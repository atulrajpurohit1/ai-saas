/**
 * Corrects CreditLedgerEntry.upstreamCostUsd from GET /v1/charges, which is
 * the only authoritative record of what BlackPearl actually billed us.
 *
 * Why this is needed. The settle path copies `job.usage.cost_usd` verbatim,
 * which is correct code reading an incorrect number: BlackPearl's reported
 * cost_usd RISES after we read it at settlement. Every real job measured on
 * 12 Oct 2026 had recorded exactly 76.92% of its eventual charge (the real
 * figure is the recorded one x 1.30, the same ratio on all five). Separately,
 * jobs that failed and were refunded recorded null while still being billed --
 * four of them, $12.03 between them. Net effect: we believed we had spent
 * $7.77 when we had spent $22.13.
 *
 * Re-reading the job endpoint later does return the full amount, so a delayed
 * re-read would fix the first problem but not the second (a charge exists for
 * jobs whose usage we never recorded at all). Reading the charge ledger fixes
 * both, and is authoritative by definition: it is the money that left the
 * account.
 *
 * Only `job_*` rows are touched. `demo-job-*` rows are seeded fiction with no
 * upstream counterpart and are left alone.
 *
 * Needs BLACKPEARL_API_KEY. A project key is sufficient -- it sees its own
 * project's charges, which is all of ours today.
 *
 *   npx ts-node -T scripts/backfill-upstream-costs.ts            # dry run
 *   npx ts-node -T scripts/backfill-upstream-costs.ts --apply
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface Charge {
  job_id?: string | null;
  amount_usd?: number;
}

/** Every job charge, summed per job id in case a job is ever charged twice. */
async function fetchBilledByJob(): Promise<Map<string, number>> {
  const apiKey = process.env.BLACKPEARL_API_KEY;
  if (!apiKey) throw new Error('BLACKPEARL_API_KEY is not set.');
  const baseUrl = (
    process.env.BLACKPEARL_BASE_URL ?? 'https://api.blackpearl.com/v1'
  ).replace(/\/$/, '');

  const billed = new Map<string, number>();
  let cursor: string | undefined;

  do {
    const url = new URL(`${baseUrl}/charges`);
    url.searchParams.set('limit', '100');
    if (cursor) url.searchParams.set('cursor', cursor);

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!response.ok) {
      throw new Error(
        `GET /v1/charges failed: HTTP ${response.status} ${await response.text()}`,
      );
    }
    const page = (await response.json()) as {
      charges?: Charge[];
      has_more?: boolean;
      next_cursor?: string;
    };
    for (const charge of page.charges ?? []) {
      if (charge.job_id && typeof charge.amount_usd === 'number') {
        // Signed: a debit is negative, a refund positive. The net is what the
        // job cost us.
        billed.set(
          charge.job_id,
          (billed.get(charge.job_id) ?? 0) + Math.abs(charge.amount_usd),
        );
      }
    }
    cursor = page.has_more ? page.next_cursor : undefined;
  } while (cursor);

  return billed;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const billed = await fetchBilledByJob();

  const rows = await prisma.creditLedgerEntry.findMany({
    where: { type: 'RESERVATION', jobId: { startsWith: 'job_' } },
    select: { id: true, jobId: true, upstreamCostUsd: true },
  });

  let corrected = 0;
  let filled = 0;
  let before = 0;
  let after = 0;

  for (const row of rows) {
    const charge = billed.get(row.jobId!);
    if (charge === undefined) continue;

    const recorded =
      row.upstreamCostUsd === null ? null : Number(row.upstreamCostUsd);
    if (recorded !== null) before += recorded;
    after += charge;

    // Nothing to do when we already match to the cent.
    if (recorded !== null && Math.abs(charge - recorded) <= 0.0001) continue;

    if (recorded === null) filled += 1;
    else corrected += 1;

    console.log(
      `${row.jobId}  ${recorded === null ? 'none' : `$${recorded.toFixed(4)}`} -> $${charge.toFixed(4)}`,
    );

    if (apply) {
      await prisma.creditLedgerEntry.update({
        where: { id: row.id },
        data: { upstreamCostUsd: charge },
      });
    }
  }

  console.log('');
  console.log(
    `  ${corrected} row(s) understated, ${filled} row(s) recorded nothing.`,
  );
  console.log(
    `  recorded total $${before.toFixed(2)} -> billed total $${after.toFixed(2)}.`,
  );
  console.log(
    apply
      ? '  Applied.'
      : '  Dry run -- nothing written. Re-run with --apply to write.',
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
