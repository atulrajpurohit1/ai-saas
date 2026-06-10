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

async function main() {
  const email = 'admin@aisaascrm.com';
  const plainPassword = 'Admin123!';
  const password = await bcrypt.hash(plainPassword, 10);

  const tenant = await prisma.tenant.upsert({
    where: { slug: 'admin-tenant' },
    update: { name: 'Default Admin Tenant' },
    create: { name: 'Default Admin Tenant', slug: 'admin-tenant' },
    select: { id: true, name: true, slug: true },
  });

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      password,
      name: 'Super Admin',
      tenantId: tenant.id,
      isSuperAdmin: true,
      branchId: null,
      role: 'ADMIN',
      refreshToken: null,
    },
    create: {
      email,
      password,
      name: 'Super Admin',
      tenantId: tenant.id,
      isSuperAdmin: true,
      role: 'ADMIN',
    },
    select: { id: true, email: true },
  });

  console.log(`Admin ready: ${user.email} / ${plainPassword}`);
  console.log(`Tenant: ${tenant.name} (${tenant.slug})`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
