const fs = require('fs');
const { PrismaClient } = require('@prisma/client');

function loadEnv(path) {
  if (!fs.existsSync(path)) return;
  const content = fs.readFileSync(path, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const index = line.indexOf('=');
    if (index === -1) continue;
    const key = line.slice(0, index);
    const value = line.slice(index + 1).replace(/^['"]|['"]$/g, '');
    process.env[key] = process.env[key] || value;
  }
}

loadEnv('.env');

const prisma = new PrismaClient();

async function main() {
  const guards = await prisma.guard.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      passwordHash: true,
      tenantId: true,
      tenant: {
        select: {
          name: true,
          slug: true
        }
      }
    }
  });
  console.log('--- GUARDS IN DATABASE ---');
  console.log(JSON.stringify(guards, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
