const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const clientUsers = await prisma.clientUser.findMany();
  const proposal = await prisma.proposal.findFirst({
    orderBy: { createdAt: 'desc' }
  });

  if (proposal && clientUsers.length > 0) {
    // Priority: atul@gmail.com, then client@gmail.com, then first available
    const targetUser = clientUsers.find(u => u.email === 'atul@gmail.com') || 
                       clientUsers.find(u => u.email === 'client@gmail.com') || 
                       clientUsers[0];
    
    await prisma.proposal.update({
      where: { id: proposal.id },
      data: { 
        clientId: targetUser.clientId,
        tenantId: targetUser.tenantId 
      }
    });
    console.log(`Successfully linked proposal ${proposal.id} to client user: ${targetUser.email}`);
  } else {
    console.log('No proposals or client users found.');
  }
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
