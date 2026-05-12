
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const targetTenantSlug = 'demo';
  const tenant = await prisma.tenant.findUnique({ where: { slug: targetTenantSlug } });
  
  if (!tenant) {
    console.log(`Tenant ${targetTenantSlug} not found.`);
    return;
  }

  const tenantId = tenant.id;

  // Move all Users to this tenant
  await prisma.user.updateMany({
    data: { tenantId }
  });

  // Move all Clients to this tenant
  await prisma.client.updateMany({
    data: { tenantId }
  });

  // Move all ClientUsers to this tenant
  await prisma.clientUser.updateMany({
    data: { tenantId }
  });

  // Move all Leads to this tenant
  await prisma.lead.updateMany({
    data: { tenantId }
  });

  // Move all Proposals to this tenant
  await prisma.proposal.updateMany({
    data: { tenantId }
  });

  // Move all Sites, Guards, etc.
  await prisma.site.updateMany({ data: { tenantId } });
  await prisma.guard.updateMany({ data: { tenantId } });
  
  console.log(`Successfully moved ALL data to tenant: ${tenant.name} (${targetTenantSlug})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
