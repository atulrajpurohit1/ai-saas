
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash('admin123', 10);
  
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'demo' },
    update: {},
    create: {
      name: 'Demo Tenant',
      slug: 'demo',
    },
  });

  await prisma.user.upsert({
    where: { email: 'demo@gmail.com' },
    update: { password: hashedPassword },
    create: {
      email: 'demo@gmail.com',
      password: hashedPassword,
      name: 'Demo User',
      role: 'ADMIN',
      tenantId: tenant.id,
      // Explicit since is_super_admin stopped defaulting to true.
      isSuperAdmin: true,
    },
  });

  console.log('Demo user created: demo@gmail.com / admin123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
