const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const tenants = await prisma.tenant.findMany();
  const clientTemplate = await prisma.client.findFirst();
  
  if (!clientTemplate) {
    console.log('No client template found. Creating a fresh client for all tenants...');
    for (const tenant of tenants) {
      await prisma.client.create({
        data: {
          name: 'Default Client',
          email: `client-${tenant.id.substring(0,5)}@gmail.com`,
          companyName: 'Test Corp',
          tenantId: tenant.id
        }
      });
    }
  } else {
    for (const tenant of tenants) {
      const existing = await prisma.client.findFirst({
        where: { tenantId: tenant.id }
      });
      if (!existing) {
        await prisma.client.create({
          data: {
            name: clientTemplate.name,
            email: `client-${tenant.id.substring(0,5)}@gmail.com`,
            companyName: clientTemplate.companyName,
            phone: clientTemplate.phone,
            tenantId: tenant.id
          }
        });
      }
    }
  }
  console.log('Successfully synchronized clients across all tenants.');
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
