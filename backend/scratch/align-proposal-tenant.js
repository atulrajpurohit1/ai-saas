const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const admin = await prisma.user.findFirst();
  const proposal = await prisma.proposal.findFirst({
    where: { id: '583f734f-4a43-4ea6-a94f-19c94ac8879f' }
  });

  if (admin && proposal) {
    await prisma.proposal.update({
      where: { id: proposal.id },
      data: { tenantId: admin.tenantId }
    });
    console.log(`Successfully moved proposal ${proposal.id} to Admin's tenant (${admin.tenantId}).`);
  } else {
    console.log('Admin or Proposal not found.');
  }
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
