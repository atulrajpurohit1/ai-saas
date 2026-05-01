import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash('admin123', 10);
  
  // 1. Create or Find Tenant
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'default' },
    update: {},
    create: {
      name: 'Default Tenant',
      slug: 'default',
    },
  });

  // 2. Create Admin User
  await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: { password: hashedPassword },
    create: {
      email: 'admin@example.com',
      password: hashedPassword,
      name: 'Admin User',
      role: 'ADMIN',
      tenantId: tenant.id,
    },
  });

  // 3. Create a Test Site
  const site = await prisma.site.create({
    data: {
      name: 'Test Site Alpha',
      address: '123 Security St',
      tenantId: tenant.id,
    },
  });

  // 4. Create a Test Guard
  const guard = await prisma.guard.create({
    data: {
      name: 'John Guard',
      phone: '555-0101',
      tenantId: tenant.id,
    },
  });

  console.log('Seed completed successfully:');
  console.log('Admin Email: admin@example.com');
  console.log('Admin Password: admin123');
  console.log('Site Created: Test Site Alpha');
  console.log('Guard Created: John Guard');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
