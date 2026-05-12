
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const clientUsers = await prisma.clientUser.findMany({
    select: {
      email: true,
      client: {
        select: {
          name: true,
          companyName: true
        }
      },
      tenant: {
        select: {
          slug: true
        }
      }
    }
  });
  console.log('Current Client Users in DB:', JSON.stringify(clientUsers, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
