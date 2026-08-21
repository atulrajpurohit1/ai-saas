// Fixes ONLY the safe, deterministic case flagged by
// audit-proposal-placeholders.ts: bracket placeholders that unambiguously
// mean "this tenant's own company name" (e.g. "[Your Company Name]",
// "[Your Security Company Name/Logo]") get replaced with the proposal's own
// tenant.name. Any other bracket token is left untouched and reported for
// manual review — this script never guesses at unrelated placeholders.
//
// Run with: npx ts-node scripts/fix-proposal-company-name-placeholders.ts
import { PrismaClient } from '@prisma/client';
import { findUnresolvedPlaceholders } from '../src/proposals/proposal-content.util';

const prisma = new PrismaClient();

const isCompanyNamePlaceholder = (token: string) =>
  /company\s*name/i.test(token);

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

  let fixedCount = 0;
  const stillFlagged: { id: string; title: string; matches: string[] }[] = [];

  for (const proposal of proposals) {
    const matches = findUnresolvedPlaceholders(proposal.content);
    if (matches.length === 0) continue;

    const companyNameTokens = matches.filter(isCompanyNamePlaceholder);
    const otherTokens = matches.filter((m) => !isCompanyNamePlaceholder(m));

    if (companyNameTokens.length > 0) {
      const nextContent = companyNameTokens.reduce(
        (content, token) => content.split(token).join(proposal.tenant.name),
        proposal.content,
      );

      await prisma.proposal.update({
        where: { id: proposal.id },
        data: { content: nextContent },
      });

      fixedCount += 1;
      console.log(`Fixed proposal "${proposal.title}" (${proposal.id}): replaced ${companyNameTokens.join(', ')} with "${proposal.tenant.name}"`);
    }

    if (otherTokens.length > 0) {
      stillFlagged.push({ id: proposal.id, title: proposal.title, matches: otherTokens });
    }
  }

  console.log(`\nFixed ${fixedCount} proposal(s).`);
  if (stillFlagged.length > 0) {
    console.log(`\n${stillFlagged.length} proposal(s) still need manual review (non-company-name placeholders):`);
    for (const p of stillFlagged) {
      console.log(`- "${p.title}" (${p.id}): ${p.matches.join(', ')}`);
    }
  } else {
    console.log('No remaining unresolved placeholders.');
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
