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
  const passwordHash = await bcrypt.hash('Guard123!', 10);
  
  const existingGuard = await prisma.guard.findFirst({ where: { email } });
  if (existingGuard) {
    await prisma.guard.update({
      where: { id: existingGuard.id },
      data: { passwordHash, tenantId: tenant.id }
    });
    console.log("Updated existing guard");
  } else {
    await prisma.guard.create({
      data: {
        email,
        passwordHash,
        name: 'Panel Guard',
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
