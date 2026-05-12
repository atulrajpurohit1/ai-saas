
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const comments = await prisma.proposalComment.findMany({
    select: {
      id: true,
      content: true,
      proposalId: true,
      userId: true,
      clientUserId: true,
      tenantId: true,
      proposal: {
        select: {
          title: true,
          tenantId: true
        }
      }
    }
  });
  console.log('Current Comments in DB:', JSON.stringify(comments, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
