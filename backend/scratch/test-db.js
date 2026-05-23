const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.$connect()
  .then(() => {
    console.log('Prisma connected successfully');
    return prisma.$disconnect();
  })
  .catch((e) => {
    console.error('Prisma connection error:', e);
    process.exit(1);
  });
