import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const email = 'admin@aisaascrm.com';
  const password = await bcrypt.hash('Admin123!', 10);
  
  // Find the tenant we created earlier
  const tenant = await prisma.tenant.findUnique({ where: { slug: 'admin-tenant' } });
  
  if (!tenant) {
    console.error('Tenant not found. Please run seed-admin.ts first.');
    process.exit(1);
  }

  // Create a Client
  let client = await prisma.client.findFirst({ where: { email } });
  if (!client) {
    client = await prisma.client.create({
      data: {
        name: 'Admin Client',
        companyName: 'Admin Client Company',
        email: email,
        tenantId: tenant.id
      }
    });
    console.log('Client created');
  } else {
    console.log('Client already exists');
  }

  // Create or Update ClientUser
  const existingClientUser = await prisma.clientUser.findUnique({ where: { email } });
  if (existingClientUser) {
    await prisma.clientUser.update({
      where: { email },
      data: { password, clientId: client.id, tenantId: tenant.id }
    });
    console.log('ClientUser updated');
  } else {
    await prisma.clientUser.create({
      data: {
        email,
        password,
        clientId: client.id,
        tenantId: tenant.id
      }
    });
    console.log('ClientUser created');
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
