const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const comments = await prisma.proposalComment.findMany({
    include: {
      proposal: true
    }
  });
  
  console.log('--- COMMENT DIAGNOSTICS ---');
  if (comments.length === 0) {
    console.log('No comments found in the database.');
  } else {
    comments.forEach(c => {
      console.log(`Comment ID: ${c.id}`);
      console.log(`Content: ${c.content}`);
      console.log(`Proposal ID: ${c.proposalId}`);
      console.log(`Proposal Tenant ID: ${c.proposal.tenantId}`);
      console.log(`User ID (Admin): ${c.userId || 'NONE (Client Comment)'}`);
      console.log('---------------------------');
    });
  }
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
