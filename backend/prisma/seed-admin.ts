
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const email = 'admin@aisaascrm.com';
  const password = await bcrypt.hash('Admin123!', 10);
  const tenantName = 'Default Admin Tenant';
  const tenantSlug = 'admin-tenant';

  // Check if tenant exists
  let tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: { name: tenantName, slug: tenantSlug }
    });
  }

  // Check if user exists
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    await prisma.user.update({
      where: { email },
      data: { password, tenantId: tenant.id }
    });
    console.log('Admin user updated');
  } else {
    await prisma.user.create({
      data: {
        email,
        password,
        name: 'Super Admin',
        tenantId: tenant.id
      }
    });
    console.log('Admin user created');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
