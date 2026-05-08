const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const clients = await prisma.client.findMany({
    include: {
      users: true
    }
  });
  
  console.log('--- CLIENTS AND PORTAL USERS ---');
  clients.forEach(c => {
    console.log(`Client: ${c.name} (${c.email})`);
    if (c.users.length > 0) {
      c.users.forEach(u => console.log(`  - Portal User: ${u.email} (Role: ${u.role})`));
    } else {
      console.log('  - No portal user created yet.');
    }
  });
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
