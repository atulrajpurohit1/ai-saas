import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.findFirst();
  if (!tenant) {
    console.log("No tenant found");
    return;
  }
  
  const email = 'guard@aegislead.com';
  const password = await bcrypt.hash('Guard123!', 10);
  
  const existingGuard = await prisma.user.findUnique({ where: { email } });
  if (existingGuard) {
    await prisma.user.update({
      where: { email },
      data: { password, role: 'GUARD', tenantId: tenant.id }
    });
    console.log("Updated existing guard");
  } else {
    await prisma.user.create({
      data: {
        email,
        password,
        name: 'Panel Guard',
        role: 'GUARD',
        tenantId: tenant.id
      }
    });
    console.log("Created new guard");
  }
  
  console.log("Credentials:");
  console.log("Email:", email);
  console.log("Password:", 'Guard123!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
