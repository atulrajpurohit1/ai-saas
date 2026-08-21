// Read-only audit: scans every Proposal for unresolved AI-template bracket
// placeholders (e.g. "[Your Company Name]"). Prints findings; makes no
// database changes. Run with: npx ts-node scripts/audit-proposal-placeholders.ts
import { PrismaClient } from '@prisma/client';
import { findUnresolvedPlaceholders } from '../src/proposals/proposal-content.util';

const prisma = new PrismaClient();

async function main() {
  const proposals = await prisma.proposal.findMany({
    select: {
      id: true,
      title: true,
      status: true,
      tenantId: true,
      content: true,
      tenant: { select: { name: true } },
    },
  });

  const flagged = proposals
    .map((p) => ({ ...p, matches: findUnresolvedPlaceholders(p.content) }))
    .filter((p) => p.matches.length > 0);

  console.log(`Scanned ${proposals.length} proposal(s) across all tenants.`);
  console.log(`Found ${flagged.length} with unresolved placeholders:\n`);

  for (const p of flagged) {
    console.log(`- [${p.status}] "${p.title}" (proposal ${p.id}, tenant "${p.tenant.name}" / ${p.tenantId})`);
    console.log(`  placeholders: ${p.matches.join(', ')}`);
  }

  if (flagged.length === 0) {
    console.log('(none)');
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
