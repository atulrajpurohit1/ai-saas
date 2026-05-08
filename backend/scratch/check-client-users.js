const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const clientUsers = await prisma.clientUser.findMany();
  
  console.log('--- CLIENT PORTAL USERS ---');
  if (clientUsers.length === 0) {
    console.log('No client portal users found.');
  } else {
    clientUsers.forEach(u => {
      console.log(`Email: ${u.email}`);
      console.log(`Password (Hashed): ${u.password.substring(0, 10)}...`);
    });
  }
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
