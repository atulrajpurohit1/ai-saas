import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const email = 'atul@gmail.com';
  const password = '12345678';
  const tenantName = 'atul';
  const tenantSlug = 'atul';

  const hashedPassword = await bcrypt.hash(password, 10);

  const tenant = await prisma.tenant.upsert({
    where: { slug: tenantSlug },
    update: {},
    create: {
      name: tenantName,
      slug: tenantSlug,
    },
  });

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      password: hashedPassword,
      tenantId: tenant.id,
      role: 'ADMIN',
    },
    create: {
      email,
      password: hashedPassword,
      name: 'Atul',
      tenantId: tenant.id,
      role: 'ADMIN',
    },
  });

  console.log('Admin user created successfully');
  console.log('Email:', email);
  console.log('Tenant:', tenantName);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
