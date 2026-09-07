const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const rows = await p.$queryRawUnsafe(`SELECT column_name FROM information_schema.columns WHERE table_name='Guard' ORDER BY column_name`);
  console.log('Guard columns:', rows.map(r => r.column_name).join(', '));
  await p.$disconnect();
})();
