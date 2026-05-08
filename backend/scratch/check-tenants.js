const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const admin = await prisma.user.findFirst({
    where: { email: 'admin@aisaascrm.com' }
  });
  
  const clients = await prisma.client.findMany();
  
  console.log('--- TENANT CHECK ---');
  console.log(`Admin (admin@aisaascrm.com) Tenant ID: ${admin?.tenantId}`);
  
  if (clients.length === 0) {
    console.log('No clients found in the database.');
  } else {
    clients.forEach(c => {
      console.log(`Client: ${c.name} | Tenant ID: ${c.tenantId}`);
    });
  }
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
