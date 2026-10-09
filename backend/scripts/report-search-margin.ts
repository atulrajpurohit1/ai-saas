/**
 * Reports what Prospect Search actually costs us per search, from the USD
 * BlackPearl reported on each finished job (CreditLedgerEntry.upstreamCostUsd),
 * next to what each credit pack charges the customer for the same search.
 *
 * Bebop will not give a USD value for a credit, and their "expected" credits
 * are a rough estimate (a ~200 quote can land anywhere from 100 to 400), so the
 * only way to price the packs is from our own measured cost. This is that
 * measurement.
 *
 * Read-only. Searches are grouped by kind (playbook / discovery) and by the
 * credits actually charged, which separates Preview from Full even if prices
 * changed over time. Searches that failed and were refunded are reported on
 * their own line: they earned nothing but may still have cost us.
 *
 * Pass --slug to limit it to real customers, and --since to skip early test
 * traffic:
 *
 *   npx ts-node -T scripts/report-search-margin.ts
 *   npx ts-node -T scripts/report-search-margin.ts --since=2026-10-01
 *   npx ts-node -T scripts/report-search-margin.ts --slug=acme,globex --since=2026-10-01
 */
import { PrismaClient } from '@prisma/client';
import {
  CREDIT_PACKS,
  CREDIT_PACK_KEYS,
} from '../src/billing/credit-packs.constants';

const prisma = new PrismaClient();

function arg(name: string): string | undefined {
  const match = process.argv.find((value) => value.startsWith(`--${name}=`));
  return match?.split('=')[1];
}

/** Nearest-rank percentile of an ascending list. */
function percentile(sorted: number[], p: number): number {
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[Math.min(sorted.length, Math.max(1, rank)) - 1];
}

function usd(value: number): string {
  return `${value < 0 ? '-' : ''}$${Math.abs(value).toFixed(2)}`;
}

function kindOf(description: string): string {
  if (description.startsWith('Company playbook')) return 'Playbook';
  if (description.startsWith('Prospect discovery')) return 'Discovery';
  return 'Other';
}

async function main() {
  const since = arg('since');
  const sinceDate = since ? new Date(since) : undefined;
  if (sinceDate && Number.isNaN(sinceDate.getTime())) {
    throw new Error(`--since is not a date: ${since}`);
  }

  const slugs = (arg('slug') ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  const rows = await prisma.creditLedgerEntry.findMany({
    where: {
      type: 'RESERVATION',
      reservationStatus: { in: ['SETTLED', 'RELEASED'] },
      ...(sinceDate ? { createdAt: { gte: sinceDate } } : {}),
      ...(slugs.length ? { tenant: { slug: { in: slugs } } } : {}),
    },
    select: {
      description: true,
      reservationStatus: true,
      settledAmount: true,
      upstreamCostUsd: true,
    },
  });

  if (!rows.length) {
    console.log('No settled Prospect Search jobs match; nothing to report.');
    return;
  }

  const groups = new Map<
    string,
    { credits: number; costs: number[]; unreported: number }
  >();

  for (const row of rows) {
    const credits = row.settledAmount ?? 0;
    const label =
      row.reservationStatus === 'RELEASED'
        ? `${kindOf(row.description)}, failed and refunded`
        : `${kindOf(row.description)}, ${credits} credits`;

    const group = groups.get(label) ?? { credits, costs: [], unreported: 0 };
    if (row.upstreamCostUsd === null) group.unreported += 1;
    else group.costs.push(Number(row.upstreamCostUsd));
    groups.set(label, group);
  }

  console.log(
    `${rows.length} settled job(s)${since ? ` since ${since}` : ''}${
      slugs.length ? ` for ${slugs.join(', ')}` : ''
    }.\n`,
  );

  for (const [label, group] of [...groups].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    const costs = [...group.costs].sort((a, b) => a - b);
    console.log(`== ${label} ==`);
    console.log(
      `  jobs: ${costs.length + group.unreported}` +
        (group.unreported
          ? ` (${group.unreported} with no cost reported)`
          : ''),
    );

    if (!costs.length) {
      console.log('  no upstream cost reported; cannot price this kind yet.\n');
      continue;
    }

    const total = costs.reduce((sum, value) => sum + value, 0);
    const p90 = percentile(costs, 90);
    const max = costs[costs.length - 1];
    console.log(
      `  our cost: min ${usd(costs[0])}  median ${usd(percentile(costs, 50))}` +
        `  mean ${usd(total / costs.length)}  p90 ${usd(p90)}  max ${usd(max)}` +
        `  total ${usd(total)}`,
    );

    if (group.credits > 0) {
      // Cost per credit at p90: the credit price a pack needs just to break
      // even on 9 searches in 10 of this kind.
      console.log(
        `  break-even credit price at p90: $${(p90 / group.credits).toFixed(4)}`,
      );
      for (const key of CREDIT_PACK_KEYS) {
        const pack = CREDIT_PACKS[key];
        const perCredit = pack.price / pack.credits;
        const revenue = perCredit * group.credits;
        const losing = costs.filter((cost) => cost > revenue).length;
        console.log(
          `  ${pack.label.padEnd(12)} charges ${usd(revenue)}` +
            `  margin at median ${usd(revenue - percentile(costs, 50))}` +
            `  at p90 ${usd(revenue - p90)}` +
            `  loses money on ${losing}/${costs.length}`,
        );
      }
    }
    console.log('');
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
