
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const leads = await prisma.lead.findMany({
    select: {
      id: true,
      name: true,
      company: true,
      tenantId: true,
      tenant: { select: { slug: true } }
    }
  });
  console.log('Leads:', JSON.stringify(leads, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
