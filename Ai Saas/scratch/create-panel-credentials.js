const fs = require('fs');
const path = require('path');
const bcrypt = require(path.join(__dirname, '..', 'backend', 'node_modules', 'bcrypt'));
const { PrismaClient } = require(path.join(__dirname, '..', 'backend', 'node_modules', '@prisma', 'client'));

const envPath = path.join(__dirname, '..', 'backend', '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index === -1) continue;
    const key = trimmed.slice(0, index);
    const value = trimmed.slice(index + 1).replace(/^"|"$/g, '');
    process.env[key] = process.env[key] || value;
  }
}

const prisma = new PrismaClient();

const guardEmail = 'guard.panel@example.com';
const guardPassword = 'Guard@12345';
const clientEmail = 'client.panel@example.com';
const clientPassword = 'Client@12345';

async function main() {
  let tenant = await prisma.tenant.findFirst({
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, slug: true },
  });

  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: { name: 'Demo Security', slug: 'demo-security' },
      select: { id: true, name: true, slug: true },
    });
  }

  const [guardHash, clientHash] = await Promise.all([
    bcrypt.hash(guardPassword, 10),
    bcrypt.hash(clientPassword, 10),
  ]);

  const guard = await prisma.guard.upsert({
    where: { id: (await prisma.guard.findFirst({ where: { email: guardEmail }, select: { id: true } }))?.id || 'missing' },
    update: {
      name: 'Panel Guard',
      phone: '+15550001001',
      passwordHash: guardHash,
      tenantId: tenant.id,
    },
    create: {
      name: 'Panel Guard',
      email: guardEmail,
      phone: '+15550001001',
      passwordHash: guardHash,
      tenantId: tenant.id,
    },
    select: { id: true, name: true, email: true, phone: true },
  });

  let client = await prisma.client.findFirst({
    where: { email: clientEmail },
    select: { id: true },
  });

  if (!client) {
    client = await prisma.client.create({
      data: {
        name: 'Panel Client',
        companyName: 'Panel Client Company',
        email: clientEmail,
        phone: '+15550002001',
        tenantId: tenant.id,
      },
      select: { id: true },
    });
  }

  const clientUser = await prisma.clientUser.upsert({
    where: { email: clientEmail },
    update: {
      password: clientHash,
      clientId: client.id,
      tenantId: tenant.id,
      refreshToken: null,
    },
    create: {
      email: clientEmail,
      password: clientHash,
      clientId: client.id,
      tenantId: tenant.id,
    },
    select: { id: true, email: true },
  });

  console.log('Created panel credentials');
  console.log(`Tenant: ${tenant.name} (${tenant.slug})`);
  console.log(`Guard panel: ${guard.email || guard.phone} / ${guardPassword}`);
  console.log(`Client panel: ${clientUser.email} / ${clientPassword}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
