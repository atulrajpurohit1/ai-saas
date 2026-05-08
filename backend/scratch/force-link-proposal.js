const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const clientUser = await prisma.clientUser.findFirst({
    where: { email: 'client@gmail.com' }
  });
  
  const proposal = await prisma.proposal.findFirst({
    orderBy: { createdAt: 'desc' }
  });

  if (clientUser && proposal) {
    await prisma.proposal.update({
      where: { id: proposal.id },
      data: { 
        clientId: clientUser.clientId,
        tenantId: clientUser.tenantId 
      }
    });
    console.log('Successfully linked the latest proposal to the active Client Portal user.');
  } else {
    console.log('Could not find client user or proposal.');
  }
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
