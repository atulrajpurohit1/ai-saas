const fs = require('fs');
const { PrismaClient } = require('@prisma/client');

for (const rawLine of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
  const line = rawLine.trim();
  if (!line || line.startsWith('#')) continue;
  const index = line.indexOf('=');
  if (index === -1) continue;
  process.env[line.slice(0, index)] = line.slice(index + 1).replace(/^['"]|['"]$/g, '');
}

const prisma = new PrismaClient();

async function main() {
  const providers = await prisma.sSOProvider.findMany({
    select: {
      id: true,
      tenantId: true,
      providerType: true,
      providerName: true,
      clientId: true,
      clientSecret: true,
      issuerUrl: true,
      metadataUrl: true,
      emailDomains: true,
      status: true,
      autoProvision: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  console.log(JSON.stringify(
    providers.map((provider) => ({
      id: provider.id,
      tenantId: provider.tenantId,
      providerType: provider.providerType,
      providerName: provider.providerName,
      clientIdType: provider.clientId
        ? provider.clientId.includes('@')
          ? 'looks_like_email'
          : 'configured'
        : 'missing',
      clientSecretConfigured: Boolean(provider.clientSecret),
      issuerUrl: provider.issuerUrl,
      metadataUrl: provider.metadataUrl,
      emailDomains: provider.emailDomains,
      status: provider.status,
      autoProvision: provider.autoProvision,
      createdAt: provider.createdAt,
      updatedAt: provider.updatedAt,
    })),
    null,
    2,
  ));
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
