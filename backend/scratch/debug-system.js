const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({ include: { tenant: true } });
  const tenants = await prisma.tenant.findMany();
  const clients = await prisma.client.findMany();

  console.log('--- SYSTEM STATE ---');
  console.log('TENANTS:');
  tenants.forEach(t => console.log(`- ${t.name} (${t.id})`));
  
  console.log('\nUSERS:');
  users.forEach(u => console.log(`- ${u.email} | Tenant: ${u.tenant?.name || 'NONE'} (${u.tenantId})`));
  
  console.log('\nCLIENTS:');
  clients.forEach(c => console.log(`- ${c.name} | Tenant ID: ${c.tenantId}`));
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
