const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const clientUser = await prisma.clientUser.findFirst({
    where: { email: 'client@gmail.com' }
  });
  
  const defaultClient = await prisma.client.findFirst({
    where: { name: 'Default Client' }
  });
  
  const proposal = await prisma.proposal.findFirst({
    where: { clientId: { not: null } },
    orderBy: { createdAt: 'desc' }
  });

  console.log('--- LINK STATUS ---');
  console.log(`Portal User (client@gmail.com) Client ID: ${clientUser?.clientId}`);
  console.log(`Target "Default Client" ID: ${defaultClient?.id}`);
  console.log(`Latest Proposal's Client ID: ${proposal?.clientId}`);

  if (clientUser && defaultClient && clientUser.clientId !== defaultClient.id) {
    await prisma.clientUser.update({
      where: { id: clientUser.id },
      data: { 
        clientId: defaultClient.id,
        tenantId: defaultClient.tenantId 
      }
    });
    console.log('SUCCESS: Re-linked client@gmail.com to the correct Default Client.');
  } else {
    console.log('No re-linking needed or data missing.');
  }
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
