const fs = require('fs');
const path = require('path');
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
  const tenant = await prisma.tenant.findFirst({
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, slug: true },
  });

  if (!tenant) {
    console.log('No tenant found.');
    return;
  }

  console.log(`Tenant: ${tenant.name} (${tenant.slug})`);

  const checks = [
    ['leads', () => prisma.lead.findMany({
      where: { tenantId: tenant.id },
      select: {
        id: true,
        name: true,
        email: true,
        company: true,
        status: true,
        createdAt: true,
        salesAssessments: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            leadScore: true,
            priorityTier: true,
            closeReadinessScore: true,
            discoveryQualityScore: true,
            recommendedNextAction: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 1,
    })],
    ['deals', () => prisma.deal.findMany({
      where: { tenantId: tenant.id },
      include: {
        lead: true,
        client: true,
        salesAssessments: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            leadScore: true,
            priorityTier: true,
            closeReadinessScore: true,
            discoveryQualityScore: true,
            recommendedNextAction: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 1,
    })],
    ['clients', () => prisma.client.findMany({
      where: { tenantId: tenant.id },
      select: {
        id: true,
        name: true,
        companyName: true,
        email: true,
        phone: true,
        createdAt: true,
        updatedAt: true,
        branchId: true,
        branch: { select: { id: true, name: true, location: true, status: true } },
        users: { select: { id: true, email: true, createdAt: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 1,
    })],
  ];

  for (const [name, query] of checks) {
    try {
      const rows = await query();
      console.log(`${name}: ok (${rows.length})`);
    } catch (error) {
      console.log(`${name}: failed`);
      console.error(error.message);
    }
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    prisma.$disconnect();
  });
